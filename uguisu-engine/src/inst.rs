use core::panic;
use std::collections::HashMap;
use codegen::ir::InstBuilder;
use codegen::settings::Configurable;
use codegen::ir;
use codegen::ir::types;
use codegen::settings;
use jit::JITModule;
use cranelift_codegen as codegen;
use cranelift_frontend as frontend;
use cranelift_jit as jit;
use cranelift_module::{self, Module, Linkage};
use cranelift_native as native;
use target_lexicon::Architecture;
use crate::ast::{self, BinaryOpKind};
use crate::builtin;

#[derive(Debug, Clone)]
struct FuncInfo {
    pub id: cranelift_module::FuncId,
    pub params: Vec<FuncParamInfo>,
    pub ret_kind: Option<ValueType>,
    pub is_external: bool,
}

#[derive(Debug, Clone)]
struct FuncParamInfo {
    pub name: String,
    pub value_kind: ValueType,
}

#[derive(Debug, Clone)]
enum ValueType {
    Number,
}

#[derive(Debug, Clone)]
pub struct CompileError {
    pub message: String,
}

impl CompileError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

#[derive(Debug)]
struct FuncDeclInfo {
    pub name: String,
    pub id: cranelift_module::FuncId,
    pub is_defined: bool,
}

#[derive(Debug, Clone)]
pub struct CompiledModule {
    pub funcs: Vec<CompiledFunction>,
}

#[derive(Debug, Clone)]
pub struct CompiledFunction {
    pub name: String,
    pub ptr: *const u8,
}

pub fn emit_module(ast: Vec<ast::Statement>) -> Result<CompiledModule, CompileError> {
    // new
    let isa_builder = native::builder().unwrap();
    let mut flag_builder = settings::builder();
    if let Err(e) = flag_builder.set("use_colocated_libcalls", "false") {
        panic!("Configuration error: {}", e.to_string());
    }
    // FIXME set back to true once the x64 backend supports it.
    let is_pic = isa_builder.triple().architecture != Architecture::X86_64;
    if let Err(e) = flag_builder.set("is_pic", if is_pic { "true" } else { "false" }) {
        panic!("Configuration error: {}", e.to_string());
    }
    let flags = settings::Flags::new(flag_builder);
    let isa = match isa_builder.finish(flags) {
        Ok(isa) => isa,
        Err(e) => { panic!("Configuration error: {}", e.to_string()); },
    };
    let mut module_builder = jit::JITBuilder::with_isa(isa, cranelift_module::default_libcall_names());
    let mut symbols: Vec<(&str, *const u8)> = Vec::new();
    symbols.push(("hello", builtin::hello as *const u8));
    symbols.push(("print_num", builtin::print_num as *const u8));
    // needs to declare the function signature for builtin functions using declare_func_internal
    // register builtin symbols.
    for symbol in symbols.iter() {
        module_builder.symbol(&symbol.0.to_string(), symbol.1);
    }
    let mut jit_module = jit::JITModule::new(module_builder);
    let mut ctx = jit_module.make_context();
    let mut builder_ctx = frontend::FunctionBuilderContext::new();
    let mut func_table = HashMap::new();
    let mut func_decl_infos: Vec<FuncDeclInfo> = Vec::new();
    for statement in ast.iter() {
        match statement {
            ast::Statement::FuncDeclaration(func_decl) => {
                let func_decl_info = emit_func_declaration(&mut jit_module, &mut ctx, &mut builder_ctx, &func_decl, &mut func_table)?;
                func_decl_infos.push(func_decl_info);
            }
            _ => { println!("[Warn] variable declaration is unexpected in the global"); },
        }
    }
    // finalize all functions
    jit_module.finalize_definitions()
        .map_err(|_| CompileError::new("Failed to generate module."))?;
    let mut module = CompiledModule {
        funcs: Vec::new(),
    };
    for func_decl_info in func_decl_infos {
        if func_decl_info.is_defined {
            // get function ptr
            let func_ptr = jit_module.get_finalized_function(func_decl_info.id);
            module.funcs.push(CompiledFunction {
                name: func_decl_info.name,
                ptr: func_ptr,
            });
        }
    }
    Ok(module)
}

fn emit_func_declaration(
    module: &mut jit::JITModule,
    ctx: &mut codegen::Context,
    builder_ctx: &mut frontend::FunctionBuilderContext,
    func_decl: &ast::FuncDeclaration,
    func_table: &mut HashMap<String, FuncInfo>,
) -> Result<FuncDeclInfo, CompileError> {
    // TODO: To successfully resolve the identifier, the function declaration is made first.
    // declare function
    let mut params = Vec::new();
    for param in func_decl.params.iter() {
        let param_type = match &param.type_name {
            Some(type_name) => {
                // TODO: support other types
                if type_name != "number" {
                    return Err(CompileError::new("unknown type"));
                }
                ValueType::Number
            },
            None => return Err(CompileError::new("Parameter type is not specified.")),
        };
        params.push(FuncParamInfo {
            name: param.name.clone(),
            value_kind: param_type,
        });
    }
    let ret_kind = match &func_decl.ret {
        Some(type_name) => {
            // TODO: support other types
            if type_name != "number" {
                return Err(CompileError::new("unknown type"));
            }
            Some(ValueType::Number)
        },
        None => None,
    };
    let name = func_decl.identifier.clone();
    let is_external = func_decl.attributes.contains(&ast::FuncAttribute::External);
    let mut signature = module.make_signature();
    for param in params.iter() {
        match param.value_kind {
            ValueType::Number => {
                signature.params.push(ir::AbiParam::new(types::I32));
            },
        }
    }
    match ret_kind {
        Some(ValueType::Number) => {
            signature.returns.push(ir::AbiParam::new(types::I32));
        },
        None => {},
    }
    let linkage = if is_external {
        Linkage::Import
    } else {
        Linkage::Local
    };
    let func_id = match module.declare_function(&name, linkage, &signature) {
        Ok(id) => id,
        Err(_) => return Err(CompileError::new("Failed to declare a function.")),
    };
    println!("[Info] function '{}' is declared.", func_decl.identifier);
    // make ir signature
    let func_info = FuncInfo {
        id: func_id,
        params: params,
        ret_kind: ret_kind,
        is_external: is_external,
    };
    // register func table
    func_table.insert(func_decl.identifier.clone(), func_info.clone());

    if let Some(body) = &func_decl.body {
        let mut emitter = FunctionEmitter::new(module, ctx, builder_ctx, func_table);
        // emit the function
        emitter.emit_body(body, &func_info, signature)?;
        // define the function
        if let Err(_) = module.define_function(func_info.id, ctx) {
            return Err(CompileError::new("failed to define a function."));
        };
        // clear the function context
        module.clear_context(ctx);
        Ok(FuncDeclInfo {
            name: name,
            id: func_id,
            is_defined: true
        })
    } else {
        Ok(FuncDeclInfo {
            name: name,
            id: func_id,
            is_defined: false
        })
    }
}

struct FunctionEmitter<'a> {
    module: &'a mut JITModule,
    builder: frontend::FunctionBuilder<'a>,
    func_table: &'a HashMap<String, FuncInfo>,
    returned: bool,
}

impl<'a> FunctionEmitter<'a> {
    pub fn new(
        module: &'a mut JITModule,
        ctx: &'a mut codegen::Context,
        builder_ctx: &'a mut frontend::FunctionBuilderContext,
        func_table: &'a HashMap<String, FuncInfo>,
    ) -> Self {
        let builder = frontend::FunctionBuilder::new(&mut ctx.func, builder_ctx);
        Self {
            module: module,
            builder: builder,
            func_table: func_table,
            returned: false,
        }
    }

    pub fn emit_body(&mut self, body: &Vec<ast::Statement>, func_info: &FuncInfo, signature: ir::Signature) -> Result<(), CompileError> {
        // FunctionEmitter.emit_function_body
        self.builder.func.signature = signature;
        self.builder.func.name = ir::UserFuncName::user(0, func_info.id.as_u32());
        let block = self.builder.create_block();
        self.builder.switch_to_block(block);
        if func_info.params.len() > 0 {
            self.builder.append_block_params_for_function_params(block);
        }

        for statement in body.iter() {
            self.emit_statement(&func_info, block, statement)?;
        }
        // If there is no jump/return at the end of the block,
        // the emitter must implicitly emit a return instruction.
        if !self.returned {
            self.builder.ins().return_(&[]);
        }
        self.builder.seal_all_blocks();
        self.builder.finalize();

        Ok(())
    }

    fn emit_statement(
        &mut self,
        func: &FuncInfo,
        block: ir::Block,
        statement: &ast::Statement,
    ) -> Result<(), CompileError> {
        match statement {
            ast::Statement::Return(Some(expr)) => {
                // NOTE: When the return instruction is emitted, the block is filled.
                let value = match self.emit_expr(func, block, &expr)? {
                    Some(v) => v,
                    None => return Err(CompileError::new("value not found")),
                };
                self.builder.ins().return_(&[value]);
                self.returned = true;
            },
            ast::Statement::Return(None) => {
                self.builder.ins().return_(&[]);
                self.returned = true;
            },
            ast::Statement::VarDeclaration(statement) => {
                // TODO: use statement.identifier
                // TODO: use statement.attributes
                let value = match self.emit_expr(func, block, &statement.expr)? {
                    Some(v) => v,
                    None => return Err(CompileError::new("The expression does not return a value.")),
                };
                return Err(CompileError::new("variable declaration is not supported yet."));
            },
            ast::Statement::Assign(statement) => {
                // TODO: use statement.identifier
                let value = match self.emit_expr(func, block, &statement.expr)? {
                    Some(v) => v,
                    None => return Err(CompileError::new("The expression does not return a value.")),
                };
                return Err(CompileError::new("assign statement is not supported yet."));
            },
            ast::Statement::FuncDeclaration(_) => {
                return Err(CompileError::new("FuncDeclaration is unexpected"));
            },
            ast::Statement::ExprStatement(expr) => {
                self.emit_expr(func, block, expr)?;
            },
        }
        Ok(())
    }

    fn emit_expr(
        &mut self,
        func: &FuncInfo,
        block: ir::Block,
        expr: &ast::Expression,
    ) -> Result<Option<ir::Value>, CompileError> {
        match expr {
            ast::Expression::Number(value) => {
                Ok(Some(self.builder.ins().iconst(types::I32, i64::from(*value))))
            },
            ast::Expression::BinaryOp(op) => {
                let left = match self.emit_expr(func, block, &op.left)? {
                    Some(v) => v,
                    None => return Err(CompileError::new("value not found")),
                };
                let right = match self.emit_expr(func, block, &op.right)? {
                    Some(v) => v,
                    None => return Err(CompileError::new("value not found")),
                };
                let value = match op.kind {
                    BinaryOpKind::Add => self.builder.ins().iadd(left, right),
                    BinaryOpKind::Sub => self.builder.ins().isub(left, right),
                    BinaryOpKind::Mult => self.builder.ins().imul(left, right),
                    BinaryOpKind::Div => self.builder.ins().udiv(left, right),
                };
                Ok(Some(value))
            },
            ast::Expression::Call(call_expr) => {
                let callee_func = match self.func_table.get(&call_expr.target_name) {
                    Some(info) => info,
                    None => {
                        let message = format!("unknown function '{}' is called.", call_expr.target_name);
                        return Err(CompileError::new(&message));
                    },
                };
                if callee_func.params.len() != call_expr.args.len() {
                    return Err(CompileError::new("parameter count is incorrect"));
                }
                let func_ref = self.module.declare_func_in_func(callee_func.id, self.builder.func);
                let mut param_values = Vec::new();
                for arg in call_expr.args.iter() {
                    match self.emit_expr(func, block, arg)? {
                        Some(v) => { param_values.push(v); },
                        None => return Err(CompileError::new("The expression does not return a value.")),
                    }
                }
                let call = self.builder.ins().call(func_ref, &param_values);
                let results = self.builder.inst_results(call);
                if results.len() > 0 {
                    Ok(Some(results[0]))
                } else {
                    Ok(None)
                }
            },
            ast::Expression::Identifier(identifier) => {
                match func.params.iter().position(|item| item.name == *identifier) {
                    Some(index) => {
                        Ok(Some(self.builder.block_params(block)[index]))
                    },
                    None => {
                        Err(CompileError::new("Identifier of variables is not supported yet")) // TODO
                    },
                }
            },
        }
    }
}

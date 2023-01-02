use crate::resolve::{self, Type, Function, ScopeLayer, Scope};
use crate::CompileError;
use core::panic;
use cranelift_codegen::ir::{types, AbiParam, Block, InstBuilder, Value};
use cranelift_codegen::settings::{builder as settingBuilder, Configurable, Flags};
use cranelift_frontend::{FunctionBuilder, FunctionBuilderContext};
use cranelift_jit::{JITBuilder, JITModule};
use cranelift_module::{self, default_libcall_names, FuncId, Linkage, Module};
use cranelift_native::builder as nativeBuilder;
use std::collections::HashMap;
use target_lexicon::Architecture;

mod builtin {
    pub fn hello() {
        println!("hello");
    }

    pub fn print_num(value: i32) {
        println!("{}", value);
    }
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

pub fn emit_module(scope: Scope) -> Result<CompiledModule, CompileError> {
    let (mut codegen_module, mut ctx) = {
        let isa_builder = nativeBuilder().unwrap();
        let mut flag_builder = settingBuilder();
        if let Err(e) = flag_builder.set("use_colocated_libcalls", "false") {
            panic!("Configuration error: {}", e.to_string());
        }
        // FIXME set back to true once the x64 backend supports it.
        let is_pic = isa_builder.triple().architecture != Architecture::X86_64;
        if let Err(e) = flag_builder.set("is_pic", if is_pic { "true" } else { "false" }) {
            panic!("Configuration error: {}", e.to_string());
        }
        let flags = Flags::new(flag_builder);
        let isa = match isa_builder.finish(flags) {
            Ok(isa) => isa,
            Err(e) => {
                panic!("Configuration error: {}", e.to_string());
            }
        };
        let mut module_builder = JITBuilder::with_isa(isa, default_libcall_names());
        let mut symbols: Vec<(&str, *const u8)> = Vec::new();
        symbols.push(("hello", builtin::hello as *const u8));
        symbols.push(("print_num", builtin::print_num as *const u8));
        // needs to declare the function signature for builtin functions using declare_func_internal
        // register builtin symbols.
        for symbol in symbols.iter() {
            module_builder.symbol(&symbol.0.to_string(), symbol.1);
        }
        let codegen_module = JITModule::new(module_builder);
        let ctx = codegen_module.make_context();
        (codegen_module, ctx)
    };
    let mut builder_ctx = FunctionBuilderContext::new();
    //let mut func_table = HashMap::new();
    //let mut func_id_table = HashMap::new();
    let mut func_decl_results: Vec<FuncId> = Vec::new();
    for layer in scope.iter() {
        for symbol in layer.symbols.iter() {
            match symbol {
                resolve::Symbol::Function(func) => {
                    emit_func_declaration(
                        &mut codegen_module,
                        &mut ctx,
                        &mut builder_ctx,
                        &mut module,
                    )?;
                }
                resolve::Symbol::Variable(var) => {}
                // _ => {
                //     println!("[Warn] variable declaration is unexpected in the global");
                // }
            }
        }
    }
    // finalize all functions
    codegen_module
        .finalize_definitions()
        .map_err(|_| CompileError::new("Failed to generate module."))?;
    let mut compiled_module = CompiledModule { funcs: Vec::new() };
    for func in func_decl_results {
        if func.is_defined {
            // get function ptr
            let func_ptr = codegen_module.get_finalized_function(func.id);
            compiled_module.funcs.push(CompiledFunction {
                name: func.name,
                ptr: func_ptr,
            });
        }
    }
    Ok(compiled_module)
}

fn emit_func_declaration(
    codegen_module: &mut JITModule,
    ctx: &mut cranelift_codegen::Context,
    builder_ctx: &mut FunctionBuilderContext,
    module: &mut resolve::Module,
) -> Result<(), CompileError> {
    // TODO: To successfully resolve the identifier, the function declaration is made first.
    // declare function
    let mut param_names = Vec::new();
    let mut param_types = Vec::new();
    for param in func_decl.params.iter() {
        let param_type = match &param.type_identifier {
            Some(type_name) => {
                // TODO: support other types
                if type_name != "number" {
                    return Err(CompileError::new("unknown type"));
                }
                Type::Number
            }
            None => return Err(CompileError::new("Parameter type is not specified.")),
        };
        param_names.push(param.identifier.clone());
        param_types.push(param_type);
    }
    let ret_kind = match &func_decl.ret {
        Some(type_name) => {
            // TODO: support other types
            if type_name != "number" {
                return Err(CompileError::new("unknown type"));
            }
            Some(Type::Number)
        }
        None => None,
    };
    let name = func_decl.identifier.clone();
    let is_external = func_decl
        .attributes
        .contains(&parse::FunctionAttribute::External);
    for param_type in param_types.iter() {
        match param_type {
            Type::Number => {
                ctx.func.signature.params.push(AbiParam::new(types::I32));
            }
            _ => panic!("unsupported type"),
        }
    }
    match ret_kind {
        Some(Type::Number) => {
            ctx.func.signature.returns.push(AbiParam::new(types::I32));
        }
        Some(_) => panic!("unsupported type"),
        None => {}
    }
    let linkage = if is_external {
        Linkage::Import
    } else {
        Linkage::Local
    };
    let func_id = match codegen_module.declare_function(&name, linkage, &ctx.func.signature) {
        Ok(id) => id,
        Err(_) => return Err(CompileError::new("Failed to declare a function.")),
    };
    println!("[Info] function '{}' is declared.", func_decl.identifier);
    let func_info = Function {
        param_names: param_names,
        params_ty: param_types,
        ret_ty: ret_kind,
        is_external: is_external,
        codegen_id: None,
    };
    // register func table
    func_table.insert(func_decl.identifier.clone(), func_info.clone());
    func_id_table.insert(func_decl.identifier.clone(), func_id);

    let mut func_defined = false;
    if let Some(body) = &func_decl.body {
        let mut emitter = FunctionEmitter::new(codegen_module, ctx, builder_ctx, func_table, func_id_table);
        // emit the function
        emitter.emit_body(body, &func_info)?;
        // define the function
        if let Err(_) = codegen_module.define_function(func_id, ctx) {
            return Err(CompileError::new("failed to define a function."));
        }
        func_defined = true;
    }

    // clear the function context
    codegen_module.clear_context(ctx);
    module.symbol_table.get();
    Ok(func_id)
}

struct FunctionEmitter<'a> {
    codegen_module: &'a mut JITModule,
    builder: FunctionBuilder<'a>,
    func_table: &'a HashMap<String, Function>,
    func_id_table: &'a HashMap<String, FuncId>,
    is_returned: bool,
}

impl<'a> FunctionEmitter<'a> {
    pub fn new(
        codegen_module: &'a mut JITModule,
        ctx: &'a mut cranelift_codegen::Context,
        builder_ctx: &'a mut FunctionBuilderContext,
        func_table: &'a HashMap<String, Function>,
        func_id_table: &'a HashMap<String, FuncId>,
    ) -> Self {
        let builder = FunctionBuilder::new(&mut ctx.func, builder_ctx);
        Self {
            codegen_module,
            builder: builder,
            func_table: func_table,
            func_id_table: func_id_table,
            is_returned: false,
        }
    }

    pub fn emit_body(
        &mut self,
        body: &Vec<parse::Node>,
        func_info: &Function,
    ) -> Result<(), CompileError> {
        //self.builder.func.name = UserFuncName::user(0, func_info.id.as_u32());
        let block = self.builder.create_block();
        self.builder.switch_to_block(block);
        if func_info.param_names.len() > 0 {
            self.builder.append_block_params_for_function_params(block);
        }

        for statement in body.iter() {
            self.emit_statement(&func_info, block, statement)?;
        }
        // If there is no jump/return at the end of the block,
        // the emitter must implicitly emit a return instruction.
        if !self.is_returned {
            self.builder.ins().return_(&[]);
        }
        self.builder.seal_all_blocks();
        self.builder.finalize();

        Ok(())
    }

    fn emit_statement(
        &mut self,
        func: &Function,
        block: Block,
        statement: &parse::Node,
    ) -> Result<(), CompileError> {
        match statement {
            parse::Node::ReturnStatement(Some(expr)) => {
                // When the return instruction is emitted, the block is filled.
                let value = match self.emit_expr(func, block, &expr)? {
                    Some(v) => v,
                    None => return Err(CompileError::new("value not found")),
                };
                self.builder.ins().return_(&[value]);
                self.is_returned = true;
            }
            parse::Node::ReturnStatement(None) => {
                self.builder.ins().return_(&[]);
                self.is_returned = true;
            }
            parse::Node::VariableDeclaration(statement) => {
                // TODO: use statement.identifier
                // TODO: use statement.attributes
                let value = match self.emit_expr(func, block, &statement.body)? {
                    Some(v) => v,
                    None => {
                        return Err(CompileError::new("The expression does not return a value."))
                    }
                };
                return Err(CompileError::new(
                    "variable declaration is not supported yet.",
                ));
            }
            parse::Node::Assignment(statement) => {
                // TODO: use statement.identifier
                let value = match self.emit_expr(func, block, &statement.body)? {
                    Some(v) => v,
                    None => {
                        return Err(CompileError::new("The expression does not return a value."))
                    }
                };
                return Err(CompileError::new("assign statement is not supported yet."));
            }
            parse::Node::FunctionDeclaration(_) => {
                return Err(CompileError::new("FuncDeclaration is unexpected"));
            }
            parse::Node::Literal(parse::Literal::Number(value)) => {
                self.emit_number(*value)?;
            }
            parse::Node::BinaryExpr(op) => {
                self.emit_binary_op(func, block, op)?;
            }
            parse::Node::CallExpr(call_expr) => {
                self.emit_call(func, block, call_expr)?;
            }
            parse::Node::Identifier(identifier) => {
                self.emit_identifier(func, block, identifier)?;
            }
        }
        Ok(())
    }

    fn emit_expr(
        &mut self,
        func: &Function,
        block: Block,
        expr: &parse::Node,
    ) -> Result<Option<Value>, CompileError> {
        match expr {
            parse::Node::Literal(parse::Literal::Number(value)) => self.emit_number(*value),
            parse::Node::BinaryExpr(op) => self.emit_binary_op(func, block, op),
            parse::Node::CallExpr(call_expr) => self.emit_call(func, block, call_expr),
            parse::Node::Identifier(identifier) => {
                self.emit_identifier(func, block, identifier)
            }
            _ => { panic!("unexpected node"); }
        }
    }

    fn emit_number(&mut self, value: i32) -> Result<Option<Value>, CompileError> {
        Ok(Some(
            self.builder.ins().iconst(types::I32, i64::from(value)),
        ))
    }

    fn emit_binary_op(
        &mut self,
        func: &Function,
        block: Block,
        binary_expr: &parse::BinaryExpr,
    ) -> Result<Option<Value>, CompileError> {
        let left = match self.emit_expr(func, block, &binary_expr.left)? {
            Some(v) => v,
            None => return Err(CompileError::new("value not found")),
        };
        let right = match self.emit_expr(func, block, &binary_expr.right)? {
            Some(v) => v,
            None => return Err(CompileError::new("value not found")),
        };
        let value = match binary_expr.operator {
            parse::Operator::Add => self.builder.ins().iadd(left, right),
            parse::Operator::Sub => self.builder.ins().isub(left, right),
            parse::Operator::Mult => self.builder.ins().imul(left, right),
            parse::Operator::Div => self.builder.ins().udiv(left, right),
        };
        Ok(Some(value))
    }

    fn emit_call(
        &mut self,
        func: &Function,
        block: Block,
        call_expr: &parse::CallExpr,
    ) -> Result<Option<Value>, CompileError> {
        let callee_name = match call_expr.callee.as_ref() {
            parse::Node::Identifier(name) => name,
            _ => panic!("unsupported callee kind"),
        };
        // let callee_func = match self.func_table.get(callee_name) {
        //     Some(info) => info,
        //     None => {
        //         let message = format!("unknown function '{}' is called.", callee_name);
        //         return Err(CompileError::new(&message));
        //     }
        // };
        let callee_id = *self.func_id_table.get(callee_name).unwrap();
        // if callee_func.param_names.len() != call_expr.args.len() {
        //     return Err(CompileError::new("parameter count is incorrect"));
        // }
        let func_ref = self
            .codegen_module
            .declare_func_in_func(callee_id, self.builder.func);
        let mut param_values = Vec::new();
        for arg in call_expr.args.iter() {
            match self.emit_expr(func, block, arg)? {
                Some(v) => {
                    param_values.push(v);
                }
                None => panic!("The expression does not return a value."),
            }
        }
        let call = self.builder.ins().call(func_ref, &param_values);
        let results = self.builder.inst_results(call);
        if results.len() > 0 {
            Ok(Some(results[0]))
        } else {
            Ok(None)
        }
    }

    fn emit_identifier(
        &mut self,
        func: &Function,
        block: Block,
        identifier: &String,
    ) -> Result<Option<Value>, CompileError> {
        match func.param_names.iter().position(|item| item == identifier) {
            Some(index) => Ok(Some(self.builder.block_params(block)[index])),
            None => {
                Err(CompileError::new(
                    "Identifier of variables is not supported yet",
                )) // TODO
            }
        }
    }
}

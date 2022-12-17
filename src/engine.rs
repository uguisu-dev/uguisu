use core::panic;
use std::{mem, collections::HashMap};
use cranelift_codegen;
use cranelift_codegen::ir::{self, InstBuilder, types, Signature};
use cranelift_codegen::settings::{self, Configurable};
use cranelift_frontend::{FunctionBuilderContext, FunctionBuilder};
use cranelift_jit::{JITModule, JITBuilder};
use cranelift_module::{default_libcall_names, Module, FuncId, Linkage};
use target_lexicon::Architecture;
use self::ast::BinaryOpKind;

mod parser;
mod ast;
mod builtin;

pub fn run(code: &str) -> Result<(), String> {
    println!("[Info] parsing ...");
    let nodes = match parser::parse(code) {
        Ok(nodes) => nodes,
        Err(e) => {
            return Err(format!("Syntax Error: {}", e.message));
        },
    };
    println!("[Info] compiling ...");
    let mut compiler = Compiler::new();
    let compiled_func = match compiler.compile(&nodes) {
        Ok(compiled_func) => compiled_func,
        Err(e) => {
            return Err(format!("Compile Error: {}", e.message));
        },
    };
    println!("[Info] running ...");
    let func = unsafe { mem::transmute::<*const u8, fn()>(compiled_func.ptr) };
    func();
    Ok(())
}

struct Compiler {
    module: JITModule,
    ctx: cranelift_codegen::Context,
    builder_ctx: FunctionBuilderContext,
    func_table: HashMap<String, FuncInfo>,
}

impl Compiler {
    pub fn new() -> Self {
        let isa_builder = cranelift_native::builder().unwrap();
        let mut flag_builder = settings::builder();
        if let Err(e) = flag_builder.set("use_colocated_libcalls", "false") {
            panic!("Configuration error: {}", e.to_string());
        };
        // FIXME set back to true once the x64 backend supports it.
        let is_pic = if isa_builder.triple().architecture != Architecture::X86_64 { "true" } else { "false" };
        if let Err(e) = flag_builder.set("is_pic", is_pic) {
            panic!("Configuration error: {}", e.to_string());
        };
        let flags = settings::Flags::new(flag_builder);
        let isa = match isa_builder.finish(flags) {
            Ok(isa) => isa,
            Err(e) => { panic!("Configuration error: {}", e.to_string()); },
        };
        let mut module_builder = JITBuilder::with_isa(isa, default_libcall_names());
        let mut symbols: Vec<(&str, *const u8)> = Vec::new();
        symbols.push(("hello", builtin::hello as *const u8));
        symbols.push(("print_num", builtin::print_num as *const u8));
        // needs to declare the function signature for builtin functions using declare_func_internal
        // register builtin symbols.
        for symbol in symbols.iter() {
            module_builder.symbol(&symbol.0.to_string(), symbol.1);
        };
        let module = JITModule::new(module_builder);
        let ctx = module.make_context();
        let builder_ctx = FunctionBuilderContext::new();
        Self {
            module: module,
            ctx: ctx,
            builder_ctx: builder_ctx,
            func_table: HashMap::new(),
        }
    }

    pub fn compile(&mut self, ast: &Vec<ast::Statement>) -> Result<CompiledFunction, CompileError> {
        for statement in ast.iter() {
            match statement {
                ast::Statement::FuncDeclaration(func_decl) => {
                    // TODO: To successfully resolve the identifier, the function declaration is made first.
                    // declare function
                    let (func_info, signature) = FunctionEmitter::declare_function(&mut self.module, func_decl)?;
                    // register func table
                    self.func_table.insert(func_decl.identifier.clone(), func_info.clone());
                    // emit function body
                    match &func_decl.body {
                        Some(body) => {
                            let mut func_emitter = FunctionEmitter::new(&mut self.module, &mut self.ctx, &mut self.builder_ctx, &mut self.func_table);
                            func_emitter.emit_function_body(body, &func_info, signature)?;
                            // define the function
                            if let Err(_) = self.module.define_function(func_info.id, &mut self.ctx) {
                                return Err(CompileError::new("failed to define a function."));
                            };
                            // clear the context for the function
                            self.module.clear_context(&mut self.ctx);
                        },
                        None => {},
                    };
                },
                _ => { println!("[Warn] variable declaration is unexpected in the global"); },
            };
        };
        // finalize all functions
        self.module.finalize_definitions()
            .map_err(|_| CompileError::new("compilation failed"))?;
        // get main function
        let main_func = match self.func_table.get("main") {
            Some(info) => info,
            None => { return Err(CompileError::new("function 'main' is not found.")); },
        };
        let func_ptr = self.module.get_finalized_function(main_func.id);
        Ok(CompiledFunction { ptr: func_ptr })
    }
}

struct CompiledFunction {
    ptr: *const u8,
}

#[derive(Debug)]
struct CompileError {
    pub message: String,
}

impl CompileError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

struct FunctionEmitter<'a> {
    module: &'a mut JITModule,
    builder: FunctionBuilder<'a>,
    func_table: &'a HashMap<String, FuncInfo>,
    returned: bool,
}

impl<'a> FunctionEmitter<'a> {
    pub fn new(
        module: &'a mut JITModule,
        ctx: &'a mut cranelift_codegen::Context,
        builder_ctx: &'a mut FunctionBuilderContext,
        func_table: &'a HashMap<String, FuncInfo>,
    ) -> Self {
        let builder = FunctionBuilder::new(&mut ctx.func, builder_ctx);
        Self {
            module,
            builder,
            func_table,
            returned: false,
        }
    }

    pub fn declare_function(module: &mut JITModule, func_decl: &ast::FuncDeclaration) -> Result<(FuncInfo, Signature), CompileError> {
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
                None => { return Err(CompileError::new("Parameter type is not specified.")); },
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
        println!("[Info] function '{}' is declared.", func_decl.identifier);
        // make ir signature
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
            Err(_) => { return Err(CompileError::new("Failed to declare a function.")); },
        };
        let func_info = FuncInfo {
            id: func_id,
            params: params,
            ret_kind: ret_kind,
            is_external: is_external,
        };
        Ok((func_info, signature))
    }

    pub fn emit_function_body(&mut self, body: &Vec<ast::Statement>, func_info: &FuncInfo, signature: Signature) -> Result<(), CompileError> {
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

    fn emit_statement(&mut self, func: &FuncInfo, block: ir::Block, statement: &ast::Statement) -> Result<(), CompileError> {
        match statement {
            ast::Statement::Return(expr) => {
                // NOTE: When the return instruction is emitted, the block is filled.
                match expr {
                    Some(expr) => {
                        let value = match self.emit_expr(func, block, &expr)? {
                            Some(v) => v,
                            None => { return Err(CompileError::new("value not found")); },
                        };
                        self.builder.ins().return_(&[value]);
                    },
                    None => {
                        self.builder.ins().return_(&[]);
                    }
                }
                self.returned = true;
            },
            ast::Statement::VarDeclaration(statement) => {
                // TODO: use statement.identifier
                // TODO: use statement.attributes
                let value = match self.emit_expr(func, block, &statement.expr)? {
                    Some(v) => v,
                    None => { return Err(CompileError::new("The expression does not return a value.")); },
                };
                return Err(CompileError::new("variable declaration is not supported yet."));
            },
            ast::Statement::Assign(statement) => {
                // TODO: use statement.identifier
                let value = match self.emit_expr(func, block, &statement.expr)? {
                    Some(v) => v,
                    None => { return Err(CompileError::new("The expression does not return a value.")); },
                };
                return Err(CompileError::new("assign statement is not supported yet."));
            },
            ast::Statement::FuncDeclaration(_) => { return Err(CompileError::new("FuncDeclaration is unexpected")); },
            ast::Statement::ExprStatement(expr) => {
                match self.emit_expr(func, block, expr) {
                    Err(e) => { return Err(e); },
                    _ => {},
                };
            },
        }
        Ok(())
    }

    fn emit_expr(&mut self, func: &FuncInfo, block: ir::Block, expr: &ast::Expression) -> Result<Option<ir::Value>, CompileError> {
        match expr {
            ast::Expression::Number(value) => {
                Ok(Some(self.builder.ins().iconst(types::I32, i64::from(*value))))
            },
            ast::Expression::BinaryOp(op) => {
                let left = self.emit_expr(func, block, &op.left);
                let left = match left {
                    Ok(Some(v)) => v,
                    Ok(None) => { return Err(CompileError::new("value not found")); },
                    Err(e) => { return Err(e); },
                };
                let right = self.emit_expr(func, block, &op.right);
                let right = match right {
                    Ok(Some(v)) => v,
                    Ok(None) => { return Err(CompileError::new("value not found")); },
                    Err(e) => { return Err(e); },
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
                    None => { return Err(CompileError::new(format!("unknown function '{}' is called.", call_expr.target_name).as_str())); },
                };
                if callee_func.params.len() != call_expr.args.len() {
                    return Err(CompileError::new("parameter count is incorrect"));
                }
                let func_ref = self.module.declare_func_in_func(callee_func.id, self.builder.func);
                let mut param_values = Vec::new();
                for arg in call_expr.args.iter() {
                    match self.emit_expr(func, block, arg) {
                        Ok(Some(v)) => { param_values.push(v); },
                        Ok(None) => { return Err(CompileError::new("The expression does not return a value.")); },
                        Err(e) => { return Err(e); },
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

#[derive(Debug, Clone)]
enum ValueType {
    Number,
}

#[derive(Debug, Clone)]
struct FuncInfo {
    pub id: FuncId,
    pub params: Vec<FuncParamInfo>,
    pub ret_kind: Option<ValueType>,
    pub is_external: bool,
}

#[derive(Debug, Clone)]
struct FuncParamInfo {
    pub name: String,
    pub value_kind: ValueType,
}

#[cfg(test)]
mod test {
    #[test]
    fn test_empty_return() {
        assert!(super::run("
            fn main() {
                return;
            }
        ").is_ok());
    }

    #[test]
    fn text_basic() {
        assert!(super::run("
            external fn print_num(value: number);
            fn add(x: number, y: number): number {
                return x + y;
            }
            fn main() {
                print_num(add(1, 2) * 3);
            }
        ").is_ok());
    }
}

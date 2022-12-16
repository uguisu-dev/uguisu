use std::collections::HashMap;
use cranelift_codegen::ir::{self, InstBuilder, types, Signature};
use cranelift_codegen::isa::TargetIsa;
use cranelift_codegen::settings::Configurable;
use cranelift_codegen::{Context, settings};
use cranelift_jit::{JITModule, JITBuilder};
use cranelift_module::{Linkage, FuncId, Module, default_libcall_names};
use cranelift_frontend::{FunctionBuilder, FunctionBuilderContext};
use target_lexicon::Architecture;
use super::ast::{self, BinaryOpKind, FuncDeclaration};
use super::builtin;

/*
 * NOTE:
 * The builtin is registered using the following functions:
 * - `JITBuilder.symbol()`
 * - `JITModule.declare_function()`
 * Functions to be registered must be declared as "Linkage::Import".
*/

#[derive(Debug)]
enum ValueType {
    Number,
    //Float,
    //String,
}

#[derive(Debug)]
struct ParamSig {
    pub name: String,
    pub value_type: ValueType,
}

#[derive(Debug)]
enum ReturnValueType {
    None,
    Value(ValueType),
}

#[derive(Debug)]
struct FuncSignature {
    pub name: String,
    pub params: Vec<ParamSig>,
    pub ret: ReturnValueType,
    pub is_external: bool,
}

impl FuncSignature {
    pub fn new(name: &str, params: Vec<ParamSig>, ret: ReturnValueType, is_external: bool) -> Self {
        Self {
            name: name.to_string(),
            params,
            ret,
            is_external,
        }
    }
}

#[derive(Debug)]
enum TranslatedValue {
    None,
    Value(ir::Value),
}

struct BuiltinSymbol {
    name: String,
    fn_ptr: *const u8,
}

struct FuncTableItem {
    func_id: FuncId,
    sig: FuncSignature,
}

#[derive(Debug)]
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

pub struct JITCompiler {
    module: JITModule,
    ctx: Context,
    builder_ctx: FunctionBuilderContext,
    func_table: HashMap<String, FuncTableItem>, // <function name, func info>
}

impl JITCompiler {
    pub fn new() -> Self {
        let isa = Self::make_isa();
        let mut module_builder = Self::make_module_builder(isa);
        let mut symbols: Vec<BuiltinSymbol> = Vec::new();
        // [builtin] fn hello()
        symbols.push(BuiltinSymbol {
            name: String::from("hello"),
            fn_ptr: builtin::hello as *const u8,
        });
        // // [builtin] fn print_num(value: number)
        // symbols.push(BuiltinSymbol {
        //     name: String::from("print_num"),
        //     fn_ptr: builtin::print_num as *const u8,
        // });

        // NOTE:
        // needs to declare the function signature for builtin functions using declare_func_internal
        // register builtin symbols.
        for symbol in symbols.iter() {
            module_builder.symbol(&symbol.name, symbol.fn_ptr);
        }
        let (module, ctx) = Self::make_module(module_builder);
        let builder_ctx = FunctionBuilderContext::new();
        let func_table = HashMap::new();
        Self {
            module,
            ctx,
            builder_ctx,
            func_table,
        }
    }

    pub fn compile(&mut self, ast: &Vec<ast::Statement>) -> Result<(), CompileError> {
        let mut node_iter = ast.iter().enumerate();
        loop {
            let statement = match node_iter.next() {
                Some((_, statement)) => statement,
                None => { break; },
            };
            match statement {
                ast::Statement::FuncDeclaration(decl_stmt) => {
                    let ir_sig = match self.declare_func(decl_stmt) {
                        Ok(v) => v,
                        Err(e) => { return Err(e); },
                    };
                    match self.define_func_body(decl_stmt, ir_sig) {
                        Err(e) => { return Err(e); },
                        _ => {},
                    }
                },
                ast::Statement::VarDeclaration(_) => { println!("[Warn] variable declaration is unexpected in the global"); },
                ast::Statement::Assign(_) => { println!("[Warn] assign statement is unexpected in the global"); },
                ast::Statement::Return(_) => { println!("[Warn] return statement is unexpected in the global"); },
                ast::Statement::ExprStatement(_) => { println!("[Warn] expression is unexpected in the global"); },
            }
        }
        if let Err(_) = self.module.finalize_definitions() {
            return Err(CompileError::new("link failed"));
        }
        Ok(())
    }

    pub fn get_func_ptr(&self, func_name: &str) -> Result<*const u8, CompileError> {
        if let Some(info) = self.func_table.get(func_name) {
            let func_ptr = self.module.get_finalized_function(info.func_id);
            Ok(func_ptr)
        } else {
            Err(CompileError::new("function not found"))
        }
    }

    fn declare_func(&mut self, decl_stmt: &FuncDeclaration) -> Result<Signature, CompileError> {
        let is_external = decl_stmt.attributes.contains(&ast::FuncAttribute::External);
        if decl_stmt.params.len() > 0 {
            return Err(CompileError::new("Declaring functions with parameters is not supported yet."));
        }
        if let Some(_) = decl_stmt.ret {
            return Err(CompileError::new("Declaring functions with return type is not supported yet."));
        }
        let params = vec![]; // TODO: resolve from decl_stmt.params
        let ret = ReturnValueType::None;// TODO: resolve from decl_stmt.ret
        let func_sig = FuncSignature::new(&decl_stmt.identifier, params, ret, is_external); 
        println!("[Info] function '{}' is declared.", func_sig.name);
        let mut ir_sig = self.module.make_signature();
        let mut param_iter = func_sig.params.iter().enumerate();
        loop {
            let param_sig = match param_iter.next() {
                Some((_, param)) => param,
                None => { break; },
            };
            match param_sig.value_type {
                ValueType::Number => {
                    ir_sig.params.push(ir::AbiParam::new(types::I32));
                },
            }
        }
        match func_sig.ret {
            ReturnValueType::Value(ValueType::Number) => {
                ir_sig.returns.push(ir::AbiParam::new(types::I32));
            },
            ReturnValueType::None => {},
        }
        let linkage = if func_sig.is_external {
            Linkage::Import
        } else {
            Linkage::Local
        };
        let name = func_sig.name.clone();
        let func_id = self.module.declare_function(&name, linkage, &ir_sig).unwrap();
        let info = FuncTableItem {
            func_id,
            sig: func_sig,
        };
        self.func_table.insert(name, info);
        Ok(ir_sig)
    }

    fn define_func_body(&mut self, decl_stmt: &FuncDeclaration, ir_sig: Signature) -> Result<(), CompileError> {
        match &decl_stmt.body {
            Some(body) => {
                let info = match self.func_table.get(&decl_stmt.identifier) {
                    Some(info) => info,
                    _ => { return Err(CompileError::new("function not found")); },
                };
                self.ctx.func.signature = ir_sig;
                self.ctx.func.name = ir::UserFuncName::user(0, info.func_id.as_u32());
                let mut translator = Translator::new(&mut self.module, &mut self.ctx.func, &mut self.builder_ctx, &self.func_table);
                match translator.translate_func_body(body) {
                    Err(e) => { return Err(e); },
                    _ => {},
                }
                if let Err(_) = self.module.define_function(info.func_id, &mut self.ctx) {
                    return Err(CompileError::new("failed to define a function."));
                }
                //println!("{:?}", self.ctx.func);
                self.module.clear_context(&mut self.ctx);
            },
            None => {},
        }
        Ok(())
    }

    fn make_isa() -> Box<dyn TargetIsa> {
        let isa_builder = cranelift_native::builder().unwrap();
        let triple = isa_builder.triple().clone();
        let flags = {
            let mut flag_builder = settings::builder();
            flag_builder.set("use_colocated_libcalls", "false").unwrap();
            // FIXME set back to true once the x64 backend supports it.
            let is_pic = if triple.architecture != Architecture::X86_64 { "true" } else { "false" };
            flag_builder.set("is_pic", is_pic).unwrap();
            settings::Flags::new(flag_builder)
        };
        isa_builder.finish(flags).unwrap()
    }

    fn make_module_builder(isa: Box<dyn TargetIsa>) -> JITBuilder {
        JITBuilder::with_isa(isa, default_libcall_names())
    }

    fn make_module(module_builder: JITBuilder) -> (JITModule, Context) {
        let module = JITModule::new(module_builder);
        let ctx = module.make_context();
        (module, ctx)
    }
}

struct Translator<'a> {
    module: &'a mut JITModule,
    func_table: &'a HashMap<String, FuncTableItem>,
    b: FunctionBuilder<'a>,
}

impl<'a> Translator<'a> {
    pub fn new(
        module: &'a mut JITModule,
        func: &'a mut ir::Function,
        builder_ctx: &'a mut FunctionBuilderContext,
        func_table: &'a HashMap<String, FuncTableItem>
    ) -> Self {
        Self {
            module,
            b: FunctionBuilder::new(func, builder_ctx),
            func_table,
        }
    }
    pub fn translate_func_body(&mut self, body: &Vec<ast::Statement>) -> Result<(), CompileError> {
        let block = self.b.create_block();
        self.b.switch_to_block(block);
        let mut iter = body.iter().enumerate();
        loop {
            let child = match iter.next() {
                Some((_, child)) => child,
                None => { break; },
            };
            match self.translate_statement(child) {
                Ok(_) => {},
                Err(e) => { return Err(e); },
            }
        }
        // TODO
        // There must be a return statement at the end of a function.
        // We can omit the following line only if there is a node of return
        // statement at the end of a function definition:
        //b.ins().return_(&[]);
        self.b.seal_all_blocks();
        self.b.finalize();
        Ok(())
    }

    fn translate_statement(&mut self, statement: &ast::Statement) -> Result<(), CompileError> {
        match statement {
            ast::Statement::Return(expr) => {
                // NOTE: When the return instruction is emitted, the block is finalized.
                match expr {
                    Some(expr) => {
                        let value = self.translate_expr(&expr);
                        let value = match value {
                            Ok(TranslatedValue::Value(v)) => v,
                            Ok(TranslatedValue::None) => { return Err(CompileError::new("value not found")); },
                            Err(e) => { return Err(e); },
                        };
                        self.b.ins().return_(&[value]);
                    },
                    None => {
                        self.b.ins().return_(&[]);
                    }
                }
            },
            ast::Statement::VarDeclaration(statement) => {
                // TODO: use statement.identifier
                // TODO: use statement.attributes
                let value = match self.translate_expr(&statement.expr) {
                    Ok(TranslatedValue::Value(v)) => v,
                    Ok(TranslatedValue::None) => { return Err(CompileError::new("The expression does not return a value.")); },
                    Err(e) => { return Err(e); },
                };
                return Err(CompileError::new("variable declaration is not supported yet."));
            },
            ast::Statement::Assign(statement) => {
                // TODO: use statement.identifier
                let value = match self.translate_expr(&statement.expr) {
                    Ok(TranslatedValue::Value(v)) => v,
                    Ok(TranslatedValue::None) => { return Err(CompileError::new("The expression does not return a value.")); },
                    Err(e) => { return Err(e); },
                };
                return Err(CompileError::new("assign statement is not supported yet."));
            },
            ast::Statement::FuncDeclaration(_) => { return Err(CompileError::new("FuncDeclaration is unexpected")); },
            ast::Statement::ExprStatement(expr) => {
                match self.translate_expr(expr) {
                    Err(e) => { return Err(e); },
                    _ => {},
                };
            },
        }
        Ok(())
    }

    fn translate_expr(&mut self, expr: &ast::Expression) -> Result<TranslatedValue, CompileError> {
        match expr {
            ast::Expression::Number(value) => {
                Ok(TranslatedValue::Value(self.b.ins().iconst(types::I32, i64::from(*value))))
            },
            ast::Expression::BinaryOp(op) => {
                let left = self.translate_expr(&op.left);
                let left = match left {
                    Ok(TranslatedValue::Value(v)) => v,
                    Ok(TranslatedValue::None) => { return Err(CompileError::new("value not found")); },
                    Err(e) => { return Err(e); },
                };
                let right = self.translate_expr(&op.right);
                let right = match right {
                    Ok(TranslatedValue::Value(v)) => v,
                    Ok(TranslatedValue::None) => { return Err(CompileError::new("value not found")); },
                    Err(e) => { return Err(e); },
                };
                let value = match op.kind {
                    BinaryOpKind::Add => self.b.ins().iadd(left, right),
                    BinaryOpKind::Sub => self.b.ins().isub(left, right),
                    BinaryOpKind::Mult => self.b.ins().imul(left, right),
                    BinaryOpKind::Div => self.b.ins().udiv(left, right),
                };
                Ok(TranslatedValue::Value(value))
            },
            ast::Expression::Call(call_expr) => {
                // TODO: args
                // call_expr.args
                let target_info = if let Some(info) = self.func_table.get(&call_expr.target_name) {
                    info
                } else {
                    return Err(CompileError::new(format!("unknown function '{}' is called.", call_expr.target_name).as_str()));
                };
                if target_info.sig.params.len() != call_expr.args.len() {
                    return Err(CompileError::new("parameter count is incorrect"));
                }
                let func_ref = self.module.declare_func_in_func(target_info.func_id, self.b.func);
                let call = self.b.ins().call(func_ref, &[]);
                let results = self.b.inst_results(call);
                if results.len() > 0 {
                    Ok(TranslatedValue::Value(results[0]))
                } else {
                    Ok(TranslatedValue::None)
                }
            },
            ast::Expression::Identifier(_) => {
                // TODO
                Err(CompileError::new("Identifier is not supported yet"))
                //Ok(TranslatedValue::None)
            },
        }
    }
}

use std::collections::HashMap;
use cranelift_codegen::ir::{self, InstBuilder, types};
use cranelift_codegen::isa::TargetIsa;
use cranelift_codegen::settings::Configurable;
use cranelift_codegen::{Context, settings};
use cranelift_jit::{JITModule, JITBuilder};
use cranelift_module::{Linkage, FuncId, Module, default_libcall_names};
use cranelift_frontend::{FunctionBuilder, FunctionBuilderContext};
use target_lexicon::Architecture;
use super::ast::{self, BinaryOpKind, Statement, FuncDeclaration};
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
    pub param_type: ValueType,
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
        // [builtin] fn print_num(value: number)
        symbols.push(BuiltinSymbol {
            name: String::from("print_num"),
            fn_ptr: builtin::print_num as *const u8,
        });
        // NOTE:
        // needs to declare the function signature for builtin functions using declare_func_internal
        // register builtin symbols.
        for symbol in symbols.iter() {
            Self::add_symbol(&mut module_builder, &symbol.name, symbol.fn_ptr);
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
                    let is_external = decl_stmt.attributes.contains(&ast::FuncAttribute::External);
                    let params = vec![]; // TODO: resolve from decl_stmt.params
                    let ret = ReturnValueType::None;// TODO: resolve from decl_stmt.ret
                    let sig = FuncSignature::new(&decl_stmt.identifier, params, ret, is_external); 
                    self.declare_func(sig);
                    match &decl_stmt.body {
                        Some(body) => {
                            match self.define_fn_body(decl_stmt, &body) {
                                Ok(_) => {},
                                Err(e) => { return Err(e); },
                            }
                        },
                        None => {},
                    }
                },
                ast::Statement::Return(_) => { return Err(CompileError::new("return statement is unexpected")); },
                ast::Statement::Expression(_) => { return Err(CompileError::new("expression is unexpected")); },
            }
        }
        if let Err(_) = self.module.finalize_definitions() {
            return Err(CompileError::new("link failed"));
        }
        Ok(())
    }

    fn define_fn_body(&mut self, decl_stmt: &FuncDeclaration, body: &Vec<Statement>) -> Result<(), CompileError> {
        let info = match self.func_table.get(&decl_stmt.identifier) {
            Some(info) => info,
            None => { return Err(CompileError::new("unknown function")); },
        };
        self.ctx.func.signature = self.make_ir_sig(&info.sig);
        self.ctx.func.name = ir::UserFuncName::user(0, info.func_id.as_u32());

        let mut b = FunctionBuilder::new(&mut self.ctx.func, &mut self.builder_ctx);
        let block = b.create_block();

        b.switch_to_block(block);
        let mut iter = body.iter().enumerate();
        loop {
            let child = match iter.next() {
                Some((_, child)) => child,
                None => { break; },
            };
            match Self::translate_statement(child, &mut b, &mut self.module, &self.func_table) {
                Ok(_) => {},
                Err(e) => { return Err(e); },
            }
        }
        // TODO
        // There must be a return statement at the end of a function.
        // We can omit the following line only if there is a node of return
        // statement at the end of a function definition:
        //b.ins().return_(&[]);
        b.seal_all_blocks();
        b.finalize();
        if let Err(_) = self.module.define_function(info.func_id, &mut self.ctx) {
            return Err(CompileError::new("failed to define a function."));
        }
        println!("{:?}", self.ctx.func);
        self.module.clear_context(&mut self.ctx);
        Ok(())
    }

    fn declare_func(&mut self, sig: FuncSignature) {
        let ir_sig = self.make_ir_sig(&sig);
        let linkage = if sig.is_external {
            Linkage::Import
        } else {
            Linkage::Local
        };
        let name = sig.name.clone();
        let func_id = self.module.declare_function(&name, linkage, &ir_sig).unwrap();
        let info = FuncTableItem {
            func_id,
            sig,
        };
        self.func_table.insert(name, info);
    }

    pub fn get_func_ptr(&self, func_name: &str) -> Result<*const u8, CompileError> {
        if let Some(info) = self.func_table.get(func_name) {
            let func_ptr = self.module.get_finalized_function(info.func_id);
            Ok(func_ptr)
        } else {
            Err(CompileError::new("function not found"))
        }
    }

    fn make_ir_sig(&self, decl: &FuncSignature) -> ir::Signature {
        let mut signature = self.module.make_signature();
        // for param in decl.params {
        //     match param {
        //         ValueType::Number => {
        //             signature.params.push(ir::AbiParam::new(types::I32));
        //         },
        //         // ValueType::Float => {
        //         //     signature.params.push(ir::AbiParam::new(types::F64));
        //         // },
        //     }
        // }
        // match decl.ret {
        //     None => {},
        //     Some(ValueType::Number) => {
        //         signature.returns.push(ir::AbiParam::new(types::I32));
        //     },
        //     // Some(ValueType::Float) => {
        //     //     signature.returns.push(ir::AbiParam::new(types::F64));
        //     // },
        // }
        signature
    }

    fn translate_statement(statement: &ast::Statement, b: &mut FunctionBuilder, module: &mut JITModule, func_table: &HashMap<String, FuncTableItem>) -> Result<(), CompileError> {
        match statement {
            ast::Statement::Return(expr) => {
                match expr {
                    Some(expr) => {
                        let value = Self::translate_expr(&expr, b, module, func_table);
                        let value = match value {
                            Ok(TranslatedValue::Value(v)) => v,
                            Ok(TranslatedValue::None) => { return Err(CompileError::new("value not found")); },
                            Err(e) => { return Err(e); },
                        };
                        b.ins().return_(&[value]);
                    },
                    None => {
                        b.ins().return_(&[]);
                    }
                }
            },
            ast::Statement::FuncDeclaration(_) => { return Err(CompileError::new("FuncDeclaration is unexpected")); },
            ast::Statement::Expression(expr) => {
                match Self::translate_expr(&expr, b, module, func_table) {
                    Err(e) => { return Err(e); },
                    _ => {},
                };
            },
        }
        Ok(())
    }

    fn translate_expr(expr: &ast::Expression, b: &mut FunctionBuilder, module: &mut JITModule, func_table: &HashMap<String, FuncTableItem>) -> Result<TranslatedValue, CompileError> {
        match expr {
            ast::Expression::Number(value) => {
                Ok(TranslatedValue::Value(b.ins().iconst(types::I32, i64::from(*value))))
            },
            ast::Expression::BinaryOp(op) => {
                let left = Self::translate_expr(&op.left, b, module, func_table);
                let left = match left {
                    Ok(TranslatedValue::Value(v)) => v,
                    Ok(TranslatedValue::None) => { return Err(CompileError::new("value not found")); },
                    Err(e) => { return Err(e); },
                };
                let right = Self::translate_expr(&op.right, b, module, func_table);
                let right = match right {
                    Ok(TranslatedValue::Value(v)) => v,
                    Ok(TranslatedValue::None) => { return Err(CompileError::new("value not found")); },
                    Err(e) => { return Err(e); },
                };
                let value = match op.kind {
                    BinaryOpKind::Add => b.ins().iadd(left, right),
                    BinaryOpKind::Sub => b.ins().isub(left, right),
                    BinaryOpKind::Mult => b.ins().imul(left, right),
                    BinaryOpKind::Div => b.ins().udiv(left, right),
                };
                Ok(TranslatedValue::Value(value))
            },
            ast::Expression::Call(call_expr) => {
                // TODO: args
                // call_expr.args
                let target_info = if let Some(info) = func_table.get(&call_expr.target_name) {
                    info
                } else {
                    return Err(CompileError::new(format!("function '{}' does not exist", call_expr.target_name).as_str()));
                };
                let func_ref = module.declare_func_in_func(target_info.func_id, &mut b.func);
                let call = b.ins().call(func_ref, &vec![]);
                let results = b.inst_results(call);
                if results.len() > 0 {
                    Ok(TranslatedValue::Value(results[0]))
                } else {
                    Ok(TranslatedValue::None)
                }
            },
        }
    }

    fn add_symbol(module_builder: &mut JITBuilder, name: &str, fn_ptr: *const u8) {
        module_builder.symbol(name, fn_ptr);
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

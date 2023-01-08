use crate::parse::{self, FunctionDeclaration, Node};
use crate::resolve::{self, Function, Type};
use crate::CompileError;
use core::panic;
use cranelift_codegen::ir::{types, AbiParam, Block, InstBuilder, Value};
use cranelift_codegen::settings::{builder as settingBuilder, Configurable, Flags};
use cranelift_frontend::{FunctionBuilder, FunctionBuilderContext};
use cranelift_jit::{JITBuilder, JITModule};
use cranelift_module::{self, default_libcall_names, FuncId, Linkage, Module};
use cranelift_native::builder as nativeBuilder;
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

pub fn emit_module(
    ast: &mut Vec<Node>,
    symbol_source: &mut Vec<resolve::Symbol>,
) -> Result<CompiledModule, CompileError> {
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
    for node in ast.iter() {
        match node {
            Node::FunctionDeclaration(func_decl) => {
                emit_func_declaration(
                    &mut codegen_module,
                    &mut ctx,
                    &mut builder_ctx,
                    symbol_source,
                    func_decl,
                )?;
            }
            _ => {}
        }
    }
    // finalize all functions
    codegen_module
        .finalize_definitions()
        .map_err(|_| CompileError::new("Failed to generate module."))?;
    let mut compiled_module = CompiledModule { funcs: Vec::new() };
    for node in ast.iter() {
        match node {
            Node::FunctionDeclaration(func_decl) => {
                if let Some(_) = func_decl.body {
                    let func_symbol = match &mut symbol_source[func_decl.symbol.unwrap()] {
                        resolve::Symbol::Function(func) => func,
                        resolve::Symbol::Variable(_) => panic!("function symbol is expected"),
                    };
                    // get function ptr
                    let func_id = FuncId::from_u32(func_symbol.codegen_id.unwrap());
                    let func_ptr = codegen_module.get_finalized_function(func_id);
                    compiled_module.funcs.push(CompiledFunction {
                        name: func_symbol.name.clone(),
                        ptr: func_ptr,
                    });
                }
            }
            _ => {}
        }
    }
    Ok(compiled_module)
}

fn emit_func_declaration(
    codegen_module: &mut JITModule,
    ctx: &mut cranelift_codegen::Context,
    builder_ctx: &mut FunctionBuilderContext,
    symbol_source: &mut Vec<resolve::Symbol>,
    func_decl: &FunctionDeclaration,
) -> Result<(), CompileError> {
    // TODO: To successfully resolve the identifier, the function declaration is made first.
    let func_id = {
        let func_symbol = match &mut symbol_source[func_decl.symbol.unwrap()] {
            resolve::Symbol::Function(func) => func,
            resolve::Symbol::Variable(_) => panic!("function symbol is expected"),
        };
        for param_type in func_symbol.param_ty_vec.iter() {
            match param_type {
                Type::Number => {
                    ctx.func.signature.params.push(AbiParam::new(types::I32));
                } //_ => panic!("unsupported type"),
            }
        }
        match func_symbol.ret_ty {
            Some(Type::Number) => {
                ctx.func.signature.returns.push(AbiParam::new(types::I32));
            }
            //Some(_) => panic!("unsupported type"),
            None => {}
        }
        let linkage = if func_symbol.is_external {
            Linkage::Import
        } else {
            Linkage::Local
        };
        let func_id = match codegen_module.declare_function(
            &func_decl.identifier,
            linkage,
            &ctx.func.signature,
        ) {
            Ok(id) => id,
            Err(_) => return Err(CompileError::new("Failed to declare a function.")),
        };
        func_symbol.codegen_id = Some(func_id.as_u32());
        println!("[Info] function '{}' is declared.", func_decl.identifier);
        func_id
    };
    if let Some(body) = &func_decl.body {
        let func_symbol = match &symbol_source[func_decl.symbol.unwrap()] {
            resolve::Symbol::Function(func) => func,
            resolve::Symbol::Variable(_) => panic!("function symbol is expected"),
        };
        let mut emitter = FunctionEmitter::new(codegen_module, ctx, builder_ctx, symbol_source);
        // emit the function
        emitter.emit_body(func_symbol, body)?;
        // define the function
        if let Err(_) = codegen_module.define_function(func_id, ctx) {
            return Err(CompileError::new("failed to define a function."));
        }
    }
    // clear the function context
    codegen_module.clear_context(ctx);
    Ok(())
}

struct FunctionEmitter<'a> {
    codegen_module: &'a mut JITModule,
    builder: FunctionBuilder<'a>,
    symbol_source: &'a Vec<resolve::Symbol>,
    is_returned: bool,
}

impl<'a> FunctionEmitter<'a> {
    pub fn new(
        codegen_module: &'a mut JITModule,
        ctx: &'a mut cranelift_codegen::Context,
        builder_ctx: &'a mut FunctionBuilderContext,
        symbol_source: &'a Vec<resolve::Symbol>,
    ) -> Self {
        let builder = FunctionBuilder::new(&mut ctx.func, builder_ctx);
        Self {
            codegen_module,
            builder: builder,
            symbol_source: symbol_source,
            is_returned: false,
        }
    }

    pub fn emit_body(
        &mut self,
        func: &Function,
        body: &Vec<parse::Node>,
        //func_info: &Function,
    ) -> Result<(), CompileError> {
        //self.builder.func.name = UserFuncName::user(0, func_info.id.as_u32());
        let block = self.builder.create_block();
        self.builder.switch_to_block(block);
        if func.param_name_vec.len() > 0 {
            self.builder.append_block_params_for_function_params(block);
        }
        for statement in body.iter() {
            self.emit_statement(func, block, statement)?;
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
                    None => panic!("unexpected error: value not found"),
                };
                self.builder.ins().return_(&[value]);
                self.is_returned = true;
            }
            parse::Node::ReturnStatement(None) => {
                self.builder.ins().return_(&[]);
                self.is_returned = true;
            }
            parse::Node::VariableDeclaration(_statement) => {
                return Err(CompileError::new(
                    "variable declaration is not supported yet.",
                ));
                // let value = match self.emit_expr(func, block, &statement.body)? {
                //     Some(v) => v,
                //     None => panic!("unexpected error: value not found"),
                // };
                // TODO: use statement.identifier
                // TODO: use statement.attributes
            }
            parse::Node::Assignment(_statement) => {
                return Err(CompileError::new("assign statement is not supported yet."));
                // let value = match self.emit_expr(func, block, &statement.body)? {
                //     Some(v) => v,
                //     None => {
                //         return Err(CompileError::new("The expression does not return a value."))
                //     }
                // };
                // TODO: support assignment
                // statement.identifier
            }
            parse::Node::FunctionDeclaration(_) => {
                panic!("unexpected error: FuncDeclaration is not supported");
            }
            parse::Node::Literal(parse::Literal::Number(value)) => {
                self.emit_number(func, block, *value)?;
            }
            parse::Node::BinaryExpr(op) => {
                self.emit_binary_op(func, block, op)?;
            }
            parse::Node::CallExpr(call_expr) => {
                self.emit_call(func, block, call_expr)?;
            }
            parse::Node::NodeRef(node_ref) => {
                self.emit_node_ref(func, block, node_ref)?;
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
            parse::Node::Literal(parse::Literal::Number(value)) => {
                self.emit_number(func, block, *value)
            }
            parse::Node::BinaryExpr(op) => self.emit_binary_op(func, block, op),
            parse::Node::CallExpr(call_expr) => self.emit_call(func, block, call_expr),
            parse::Node::NodeRef(node_ref) => self.emit_node_ref(func, block, node_ref),
            _ => {
                panic!("unexpected node");
            }
        }
    }

    fn emit_number(
        &mut self,
        _func: &Function,
        _block: Block,
        value: i32,
    ) -> Result<Option<Value>, CompileError> {
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
        let callee_id = match call_expr.callee.as_ref() {
            Node::NodeRef(node_ref) => {
                let resolved = match &node_ref.resolved {
                    Some(x) => x,
                    None => panic!("unresolved callee"),
                };
                match &self.symbol_source[resolved.symbol] {
                    resolve::Symbol::Function(func) => FuncId::from_u32(func.codegen_id.unwrap()),
                    _ => panic!("unexpected callee"),
                }
            }
            _ => panic!("unexpected node type. (callee of emit call)"),
        };
        let func_ref = self
            .codegen_module
            .declare_func_in_func(callee_id, self.builder.func);
        let mut param_values = Vec::new();
        for arg in call_expr.args.iter() {
            match self.emit_expr(func, block, arg)? {
                Some(v) => {
                    param_values.push(v);
                }
                None => panic!("unexpected error: value not found"),
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

    fn emit_node_ref(
        &mut self,
        _func: &Function,
        block: Block,
        node_ref: &parse::NodeRef,
    ) -> Result<Option<Value>, CompileError> {
        let resolved = match &node_ref.resolved {
            Some(x) => x,
            None => panic!("unexpected error: the identifier is not resolved"),
        };
        match &self.symbol_source[resolved.symbol] {
            resolve::Symbol::Function(_) => {
                panic!("unexpectec error: Identifier of function is not supported");
            }
            resolve::Symbol::Variable(var) => {
                if var.is_func_param {
                    Ok(Some(self.builder.block_params(block)[var.func_param_index]))
                } else {
                    // TODO
                    Err(CompileError::new(
                        "Identifier of variables is not supported yet",
                    ))
                }
            }
        }
    }
}

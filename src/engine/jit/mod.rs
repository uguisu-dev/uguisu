use std::collections::HashMap;
use std::mem;
use cranelift_codegen::{ir, Context};
use cranelift_codegen::ir::{InstBuilder, Signature};
use cranelift_codegen::ir::types;
use cranelift_jit::JITModule;
use cranelift_module::{Linkage, FuncId, Module};
use cranelift_frontend::{FunctionBuilder, FunctionBuilderContext};
use super::builtin;

mod backend;

#[derive(Debug, Clone, Copy)]
pub enum ValueType {
  Number,
  //Float,
  //String,
}

struct FuncDeclaration {
  name: String,
  params: Vec<ValueType>,
  ret: Option<ValueType>,
  is_external: bool,
}

struct BuiltinSymbol {
  name: String,
  fn_ptr: *const u8,
}

struct FuncInfo {
  func_id: FuncId,
  signature: Signature,
}

pub struct JITCompiler {
  module: JITModule,
  ctx: Context,
  builder_ctx: FunctionBuilderContext,
  declarations: Vec<FuncDeclaration>,
  func_table: HashMap<String, FuncInfo>, // <function name, func info>
}

impl JITCompiler {
  pub fn new() -> Self {
    let isa = backend::make_isa();
    let mut module_builder = backend::make_module_builder(isa);

    let mut declarations: Vec<FuncDeclaration> = Vec::new();

    let mut symbols: Vec<BuiltinSymbol> = Vec::new();

    // [builtin] fn hello()
    symbols.push(BuiltinSymbol {
      name: String::from("hello"),
      fn_ptr: builtin::hello as *const u8,
    });

    // NOTE: needs to declare the function signature for builtin functions using Backend::declare_fn()

    // register builtin symbols.
    for symbol in symbols.iter() {
      backend::add_symbol_manually(&mut module_builder, &symbol.name, symbol.fn_ptr);
    }

    let (module, ctx) = backend::make_module(module_builder);
    let builder_ctx = backend::make_builder_ctx();

    let func_table = HashMap::new();

    Self {
      module,
      ctx,
      builder_ctx,
      declarations,
      func_table,
    }
  }

  pub fn compile(&mut self) {
    {
      // builtin fn hello()
      let params: Vec<ValueType> = Vec::new();
      let ret = None;
      let dec = FuncDeclaration {
        name: String::from("hello"),
        params,
        ret,
        is_external: true,
      };
      self.declarations.push(dec);
    }

    {
      // fn a(arg1: i32) -> i32
      let mut params: Vec<ValueType> = Vec::new();
      params.push(ValueType::Number);
      let ret = Some(ValueType::Number);
      let dec = FuncDeclaration {
        name: String::from("a"),
        params,
        ret,
        is_external: false,
      };
      self.declarations.push(dec);
    }

    {
      // fn b() -> i32
      let params: Vec<ValueType> = Vec::new();
      let ret = Some(ValueType::Number);
      let dec = FuncDeclaration {
        name: String::from("b"),
        params,
        ret,
        is_external: false,
      };
      self.declarations.push(dec);
    }

    // declare functions
    for fn_dec in &mut self.declarations {
      let linkage = if fn_dec.is_external {
        Linkage::Import
      } else {
        Linkage::Local
      };
      let (func_id, signature) = backend::declare_fn(&mut self.module, &fn_dec.name, &fn_dec.params, &fn_dec.ret, linkage);
      let info = FuncInfo {
        func_id,
        signature,
      };
      self.func_table.insert(fn_dec.name.clone(), info);
    }

    {
      /*
      fn a(arg1: i32) -> i32 {
        let param = arg1;
        let cst = 37;
        let add = param + cst;
        add
      }
      */
      //self.backend_module.ctx.set_disasm(true);
      let func_a = self.func_table.get("a").unwrap();
      self.ctx.func.signature = func_a.signature.clone();
      self.ctx.func.name = ir::UserFuncName::user(0, func_a.func_id.as_u32());

      let mut b = FunctionBuilder::new(&mut self.ctx.func, &mut self.builder_ctx);
      let block = b.create_block();

      b.switch_to_block(block);
      b.append_block_params_for_function_params(block);
      let param = b.block_params(block)[0];
      // 37 + param
      let cst = b.ins().iconst(types::I32, 37);
      let add = b.ins().iadd(cst, param);
      // return
      b.ins().return_(&[add]);
      b.seal_all_blocks();
      b.finalize();

      self.module.define_function(func_a.func_id, &mut self.ctx).unwrap();
      //let compile_result = self.backend_module.ctx.compiled_code().unwrap().clone();
      //println!("{:?}", compile_result.code_buffer());
      //println!("{}", compile_result.disasm.unwrap());
      self.module.clear_context(&mut self.ctx);
    }

    {
      /*
      fn b() -> i32 {
        let local_func = a;
        let arg = 5;
        let result = call(local_func, [arg]);
        let value = result.inst_result[0];
        value
      }
      */
      //self.backend_module.ctx.set_disasm(true);
      let func_b = self.func_table.get("b").unwrap();
      self.ctx.func.signature = func_b.signature.clone();
      self.ctx.func.name = ir::UserFuncName::user(0, func_b.func_id.as_u32());

      let mut b = FunctionBuilder::new(&mut self.ctx.func, &mut self.builder_ctx);
      let block = b.create_block();

      b.switch_to_block(block);
      // call b
      let func_a = self.func_table.get("a").unwrap().clone();
      let func_ref = self.module.declare_func_in_func(func_a.func_id, &mut b.func);
      let arg = b.ins().iconst(types::I32, 5);
      let call = b.ins().call(func_ref, &[arg]);
      let value = {
        let results = b.inst_results(call);
        assert_eq!(results.len(), 1);
        results[0].clone()
      };
      // call hello
      let func_hello = self.func_table.get("hello").unwrap().clone();
      let func_ref = self.module.declare_func_in_func(func_hello.func_id, &mut b.func);
      let call = b.ins().call(func_ref, &[]);
      let results = b.inst_results(call);
      assert_eq!(results.len(), 0);
      // return
      b.ins().return_(&[value]);
      b.seal_all_blocks();
      b.finalize();

      self.module.define_function(func_b.func_id, &mut self.ctx).unwrap();
      //let compile_result = self.backend_module.ctx.compiled_code().unwrap().clone();
      //println!("{:?}", compile_result.code_buffer());
      //println!("{}", compile_result.disasm.unwrap());
      self.module.clear_context(&mut self.ctx);
    }

    backend::link(&mut self.module);

    // get generated function
    let func_b = self.func_table.get("b").unwrap();
    let fn_b = backend::get_function(&self.module, func_b.func_id);
    let fn_b = unsafe { mem::transmute::<*const u8, fn() -> u32>(fn_b) };

    let res = fn_b();
    println!("{}", res);
    assert_eq!(res, 42);
  }
}

use std::collections::HashMap;
use std::mem;
use target_lexicon::{Triple, Architecture};
use cranelift_codegen::{Context};
use cranelift_codegen::ir;
use cranelift_codegen::ir::{InstBuilder};
use cranelift_codegen::ir::types;
use cranelift_codegen::settings;
use cranelift_codegen::settings::{Configurable};
use cranelift_module::{default_libcall_names, Linkage, Module, FuncId};
use cranelift_frontend::{FunctionBuilder, FunctionBuilderContext};
use cranelift_jit::{JITBuilder, JITModule};

use super::builtin;

/*
 * NOTE:
 * The runtime is registered using the following functions:
 * - `module_builder.symbol()`
 * - `module.declare_function()`
 * Functions to be registered must be declared as "Linkage::Import".
*/

pub enum ValueType {
  Number,
  Float,
  //String,
}

struct BuiltinSig {
  name: String,
  params: Vec<ValueType>,
  ret: Option<ValueType>,
  fn_ptr: *const u8,
}

pub struct Engine {
  triple: Triple,
  module: JITModule,
  gen_ctx: Context,
  /// NOTE: temporary used by function builders.
  fb_ctx: FunctionBuilderContext,

  builtin_sig: Vec<BuiltinSig>,
  builtin_table: HashMap<String, FuncId>, // <function name, func id>
}

impl Engine {
  pub fn new() -> Self {
    let isa_builder = cranelift_native::builder().unwrap();

    let triple = isa_builder.triple().clone();

    let mut flag_builder = settings::builder();
    flag_builder.set("use_colocated_libcalls", "false").unwrap();

    // FIXME set back to true once the x64 backend supports it.
    let is_pic = if triple.architecture != Architecture::X86_64 { "true" } else { "false" };
    flag_builder.set("is_pic", is_pic).unwrap();

    let flags = settings::Flags::new(flag_builder);

    let isa = isa_builder.finish(flags).unwrap();

    let mut module_builder = JITBuilder::with_isa(isa, default_libcall_names());

    let builtin_sig = prepare_builtin();

    // add builtin symbols
    for dec in builtin_sig.iter() {
      module_builder.symbol(&dec.name, dec.fn_ptr);
    }

    let module = JITModule::new(module_builder);
    let gen_ctx = module.make_context();
    let fb_ctx = FunctionBuilderContext::new(); // worker for functions

    Self {
      triple,
      module,
      gen_ctx,
      fb_ctx,
      builtin_sig,
      builtin_table: HashMap::new(),
    }
  }

  pub fn compile(&mut self) {
    // declare builtin
    for sig in &mut self.builtin_sig {
      let (func_id, _) = declare_fn(&mut self.module, &sig.name, &sig.params, &sig.ret, Linkage::Import);
      self.builtin_table.insert(sig.name.clone(), func_id);
    }

    // TODO: get function information from the store
    // fn a(arg1: i32) -> i32
    let mut params: Vec<ValueType> = Vec::new();
    params.push(ValueType::Number);
    let ret = Some(ValueType::Number);
    let (func_a, sig_a) = declare_fn(&mut self.module, "a", &params, &ret, Linkage::Local);

    // fn b() -> i32
    let params: Vec<ValueType> = Vec::new();
    let ret = Some(ValueType::Number);
    let (func_b, sig_b) = declare_fn(&mut self.module, "b", &params, &ret, Linkage::Local);

    {
      /*
      fn a(arg1: i32) -> i32 {
        let param = arg1;
        let cst = 37;
        let add = param + cst;
        add
      }
      */
      //self.gen_ctx.set_disasm(true);
      self.gen_ctx.func.signature = sig_a;
      self.gen_ctx.func.name = ir::UserFuncName::user(0, func_a.as_u32());

      let mut b = FunctionBuilder::new(&mut self.gen_ctx.func, &mut self.fb_ctx);
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

      self.module.define_function(func_a, &mut self.gen_ctx).unwrap();
      //let compile_result = self.gen_ctx.compiled_code().unwrap().clone();
      //println!("{:?}", compile_result.code_buffer());
      //println!("{}", compile_result.disasm.unwrap());
      self.module.clear_context(&mut self.gen_ctx);
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
      //self.gen_ctx.set_disasm(true);
      self.gen_ctx.func.signature = sig_b;
      self.gen_ctx.func.name = ir::UserFuncName::user(0, func_b.as_u32());

      let mut b = FunctionBuilder::new(&mut self.gen_ctx.func, &mut self.fb_ctx);
      let block = b.create_block();

      b.switch_to_block(block);
      // call b
      let func_ref = self.module.declare_func_in_func(func_a, &mut b.func);
      let arg = b.ins().iconst(types::I32, 5);
      let call = b.ins().call(func_ref, &[arg]);
      let value = {
        let results = b.inst_results(call);
        assert_eq!(results.len(), 1);
        results[0].clone()
      };
      // call hello
      let hello_id = self.builtin_table.get("hello").unwrap().clone();
      let func_ref = self.module.declare_func_in_func(hello_id, &mut b.func);
      let call = b.ins().call(func_ref, &[]);
      let results = b.inst_results(call);
      assert_eq!(results.len(), 0);
      // return
      b.ins().return_(&[value]);
      b.seal_all_blocks();
      b.finalize();

      self.module.define_function(func_b, &mut self.gen_ctx).unwrap();
      //let compile_result = self.gen_ctx.compiled_code().unwrap().clone();
      //println!("{:?}", compile_result.code_buffer());
      //println!("{}", compile_result.disasm.unwrap());
      self.module.clear_context(&mut self.gen_ctx);
    }

    // link code
    self.module.finalize_definitions().unwrap();

    // get generated function
    let fn_b_ptr = self.module.get_finalized_function(func_b);
    let fn_b = unsafe { mem::transmute::<*const u8, fn() -> u32>(fn_b_ptr) };

    let res = fn_b();
    println!("{}", res);
    assert_eq!(res, 42);
  }
}

fn prepare_builtin() -> Vec<BuiltinSig> {
  let mut dec_list: Vec<BuiltinSig> = Vec::new();

  dec_list.push(BuiltinSig {
    name: String::from("hello"),
    params: vec![],
    ret: None,
    fn_ptr: builtin::hello as *const u8,
  });

  dec_list
}

fn declare_fn(module: &mut JITModule, name: &str, params: &Vec<ValueType>, ret: &Option<ValueType>, linkage: Linkage) -> (FuncId, ir::Signature) {
  // make signature
  let mut signature = module.make_signature();
  for param in params {
    match param {
      ValueType::Number => {
        signature.params.push(ir::AbiParam::new(types::I32));
      },
      ValueType::Float => {
        signature.params.push(ir::AbiParam::new(types::F64));
      },
    }
  }
  match ret {
    None => {},
    Some(ValueType::Number) => {
      signature.returns.push(ir::AbiParam::new(types::I32));
    },
    Some(ValueType::Float) => {
      signature.returns.push(ir::AbiParam::new(types::F64));
    },
  }

  // declare function
  let func_id = module.declare_function(name, linkage, &signature).unwrap();

  (func_id, signature)
}

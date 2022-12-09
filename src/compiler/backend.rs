use target_lexicon::{Architecture};
use cranelift_codegen::{Context};
use cranelift_codegen::ir;
use cranelift_codegen::ir::types;
use cranelift_codegen::isa::{TargetIsa};
use cranelift_codegen::settings;
use cranelift_codegen::settings::{Configurable};
use cranelift_module::{default_libcall_names, Linkage, Module, FuncId, FuncOrDataId};
use cranelift_frontend::FunctionBuilderContext;
use cranelift_jit::{JITBuilder, JITModule};
use cranelift_native;

use super::types::ValueType;

/*
 * NOTE:
 * The builtin is registered using the following functions:
 * - `JITBuilder.symbol()`
 * - `JITModule.declare_function()`
 * Functions to be registered must be declared as "Linkage::Import".
*/

pub fn make_isa() -> Box<dyn TargetIsa> {
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

pub fn make_module_builder(isa: Box<dyn TargetIsa>) -> JITBuilder {
  JITBuilder::with_isa(isa, default_libcall_names())
}

pub fn make_module(module_builder: JITBuilder) -> (JITModule, Context) {
  let module = JITModule::new(module_builder);
  let ctx = module.make_context();
  (module, ctx)
}

pub fn make_builder_ctx() -> FunctionBuilderContext {
  FunctionBuilderContext::new()
}

pub fn add_symbol_manually(module_builder: &mut JITBuilder, name: &str, fn_ptr: *const u8) {
  module_builder.symbol(name, fn_ptr);
}

pub fn declare_fn(module: &mut JITModule, name: &str, params: &Vec<ValueType>, ret: &Option<ValueType>, linkage: Linkage) -> (FuncId, ir::Signature) {
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

pub fn link(module: &mut JITModule) {
  module.finalize_definitions().unwrap();
}

pub fn get_func_id(module: &JITModule, fn_name: &str) -> FuncId {
  let name = module.get_name(fn_name).unwrap();
  match name {
    FuncOrDataId::Func(func) => func,
    _ => { panic!("{} is not function", fn_name); },
  }
}

pub fn get_function(module: &JITModule, func_id: FuncId) -> *const u8 {
  module.get_finalized_function(func_id)
}

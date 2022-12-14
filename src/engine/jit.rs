use std::collections::HashMap;
use cranelift_codegen::isa::TargetIsa;
use cranelift_codegen::settings::Configurable;
use cranelift_codegen::{ir, Context, settings};
use cranelift_codegen::ir::{Signature, InstBuilder};
use cranelift_codegen::ir::types;
use cranelift_jit::{JITModule, JITBuilder};
use cranelift_module::{Linkage, FuncId, Module, default_libcall_names};
use cranelift_frontend::{FunctionBuilder, FunctionBuilderContext};
use target_lexicon::Architecture;
use super::builtin;

/*
 * NOTE:
 * The builtin is registered using the following functions:
 * - `JITBuilder.symbol()`
 * - `JITModule.declare_function()`
 * Functions to be registered must be declared as "Linkage::Import".
*/

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

#[derive(Debug, Clone, Copy)]
pub enum ValueType {
  Number,
  //Float,
  //String,
}

pub struct FuncDeclaration {
  name: String,
  params: Vec<ValueType>,
  ret: Option<ValueType>,
  is_external: bool,
}

impl FuncDeclaration {
  pub fn new(name: &str, params: Vec<ValueType>, ret: Option<ValueType>, is_external: bool) -> Self {
    Self {
      name: name.to_string(),
      params,
      ret,
      is_external,
    }
  }
}

struct BuiltinSymbol {
  name: String,
  fn_ptr: *const u8,
}

struct FuncTableItem {
  func_id: FuncId,
  signature: Signature,
}

pub struct JITCompiler {
  module: JITModule,
  ctx: Context,
  builder_ctx: FunctionBuilderContext,
  declarations: Vec<FuncDeclaration>,
  func_table: HashMap<String, FuncTableItem>, // <function name, func info>
}

impl JITCompiler {
  pub fn new() -> Self {
    let isa = Self::make_isa();
    let mut module_builder = Self::make_module_builder(isa);

    let mut declarations: Vec<FuncDeclaration> = Vec::new();

    let mut symbols: Vec<BuiltinSymbol> = Vec::new();

    // [builtin] fn hello()
    symbols.push(BuiltinSymbol {
      name: String::from("hello"),
      fn_ptr: builtin::hello as *const u8,
    });

    // NOTE: needs to declare the function signature for builtin functions using declare_func_internal

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
      declarations,
      func_table,
    }
  }

  pub fn declare_func(&mut self, func: &FuncDeclaration) {
    let linkage = if func.is_external {
      Linkage::Import
    } else {
      Linkage::Local
    };
    let (func_id, signature) = self.gen_declare_func(&func.name, &func.params, &func.ret, linkage);
    let info = FuncTableItem {
      func_id,
      signature,
    };
    self.func_table.insert(func.name.clone(), info);
  }

  pub fn define_func(&mut self, func: &FuncDeclaration) -> Result<(), CompileError> {
    let linkage = Linkage::Local;
    let (func_id, signature) = self.gen_declare_func(&func.name, &func.params, &func.ret, linkage);
    let info = FuncTableItem {
      func_id,
      signature: signature.clone(),
    };
    self.func_table.insert(func.name.clone(), info);

    self.ctx.func.signature = signature;
    self.ctx.func.name = ir::UserFuncName::user(0, func_id.as_u32());

    let mut b = FunctionBuilder::new(&mut self.ctx.func, &mut self.builder_ctx);

    let block = b.create_block();
    b.switch_to_block(block);
    // TODO: build IR
    b.ins().return_(&[]);

    b.seal_all_blocks();
    b.finalize();

    if let Err(_) = self.module.define_function(func_id, &mut self.ctx) {
      return Err(CompileError::new("failed to define a function."));
    }
    self.module.clear_context(&mut self.ctx);

    Ok(())
  }

  pub fn link(&mut self) -> Result<(), CompileError> {
    if let Ok(_) = self.module.finalize_definitions() {
      Ok(())
    } else {
      Err(CompileError::new("link failed"))
    }
  }

  // cast a pointer to a function.
  // let func = unsafe { mem::transmute::<*const u8, fn()>(func_ptr) };
  pub fn get_func_ptr(&self, func_name: &str) -> Result<*const u8, CompileError> {
    if let Some(info) = self.func_table.get(func_name) {
      let func_ptr = self.module.get_finalized_function(info.func_id);
      Ok(func_ptr)
    } else {
      Err(CompileError::new("function not found"))
    }
  }

  fn gen_declare_func(&mut self, name: &str, params: &Vec<ValueType>, ret: &Option<ValueType>, linkage: Linkage) -> (FuncId, ir::Signature) {
    // make signature
    let mut signature = self.module.make_signature();
    for param in params {
      match param {
        ValueType::Number => {
          signature.params.push(ir::AbiParam::new(types::I32));
        },
        // ValueType::Float => {
        //   signature.params.push(ir::AbiParam::new(types::F64));
        // },
      }
    }
    match ret {
      None => {},
      Some(ValueType::Number) => {
        signature.returns.push(ir::AbiParam::new(types::I32));
      },
      // Some(ValueType::Float) => {
      //   signature.returns.push(ir::AbiParam::new(types::F64));
      // },
    }
  
    // declare function
    let func_id = self.module.declare_function(name, linkage, &signature).unwrap();
  
    (func_id, signature)
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

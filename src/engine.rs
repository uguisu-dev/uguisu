use std::mem;
use jit::{JITCompiler, FuncDeclaration};

mod parser;
mod ast;
mod jit;
mod builtin;

pub fn run(code: &str) {
  let nodes = match parser::parse(code) {
    Ok(nodes) => nodes,
    Err(e) => {
      println!("Syntax Error: {}", e.message);
      return;
    },
  };
  println!("{:#?}", nodes);

  // TODO: use nodes
  let mut jit = JITCompiler::new();

  let func_name = "abc";
  let func = FuncDeclaration::new(func_name, vec![], None, false);

  if let Err(e) = jit.define_func(&func) {
    println!("{}", e.message);
    return;
  }

  if let Err(e) = jit.link() {
    println!("{}", e.message);
    return;
  }

  let func = match jit.get_func_ptr(func_name) {
    Ok(func_ptr) => unsafe { mem::transmute::<*const u8, fn()>(func_ptr) },
    Err(e) => {
      println!("{}", e.message);
      return;
    },
  };

  func();

  println!("terminated");
}

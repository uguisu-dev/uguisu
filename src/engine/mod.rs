use crate::engine::jit::JITCompiler;

mod parser;
mod jit;
mod builtin;

pub fn run(code: &str) {
  match parser::parse(code) {
    Ok(nodes) => {
      println!("{:#?}", nodes);
      // TODO: use nodes
      let mut jit = JITCompiler::new();
      jit.compile();
    },
    Err(e) => println!("Syntax Error: {}", e.message),
  }
}

use crate::{jit, parser};

pub fn run(code: &str) {
  match parser::parse(code) {
    Ok(nodes) => {
      println!("{:#?}", nodes);
      // TODO: use nodes
      let mut jit_engine = jit::frontend::Engine::new();
      jit_engine.compile();
    },
    Err(e) => println!("Syntax Error: {}", e.message),
  }
}

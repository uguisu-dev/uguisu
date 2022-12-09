use crate::compiler::frontend;

mod compiler;
mod parser;

fn main() {
  let mut jit_engine = frontend::Engine::new();
  jit_engine.compile();
}

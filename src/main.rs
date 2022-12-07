use crate::compiler::jit;

mod compiler;
mod parser;

fn main() {
  let mut jit_engine = jit::Engine::new();
  jit_engine.compile();
}

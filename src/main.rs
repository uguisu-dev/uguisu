mod compiler;
mod parser;

use crate::compiler::jit;

fn main() {
    let mut jit_engine = jit::Engine::new();
    jit_engine.compile();
}

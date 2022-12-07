use crate::frontend::Engine;

mod frontend;
mod mir;
mod runtime;

fn main() {
    let mut engine = Engine::new();
    engine.compile();
}

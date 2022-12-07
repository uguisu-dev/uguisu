use crate::frontend::Engine;

mod frontend;
mod mir;
mod runtime;

// mod experiments {
//     pub mod basic_fn;
// }

fn main() {
    // experiments::basic_fn::run();

    let mut engine = Engine::new();
    engine.compile();
}

use std::{env, fs::File, io::Read};
use uguisu_engine::Engine;

pub fn command() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        println!("Error: Please specify a filename.");
        return;
    }

    let filename = &args[1];
    let mut file = match File::open(filename) {
        Ok(x) => x,
        Err(_) => return println!("Error: Failed to open the file."),
    };

    let mut code = String::new();
    match file.read_to_string(&mut code) {
        Ok(_) => {}
        Err(_) => return println!("Error: Failed to read the file."),
    };

    let mut engine = Engine::new();

    let ast = match engine.parse(&code) {
        Ok(x) => x,
        Err(e) => return println!("SyntaxError: {}", e.message),
    };

    let graph = match engine.analyze(ast) {
        Ok(x) => x,
        Err(e) => return println!("SyntaxError: {}", e.message),
    };

    match engine.run(graph) {
        Ok(_) => {}
        Err(e) => return println!("RuntimeError: {}", e.message),
    };
}

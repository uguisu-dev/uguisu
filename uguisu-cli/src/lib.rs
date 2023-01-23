use std::{env, fs::File, io::Read};
use uguisu_engine::Engine;

pub fn parse_command() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        show_help();
        return;
    }
    if &args[1] == "-h" {
        show_help();
        return;
    }
    if &args[1] == "-V" {
        show_version();
        return;
    }
    run_script(&args[1]);
}

fn show_help() {
    println!("Usage: uguisu [OPTIONS] INPUT");
    println!("");
    println!("Options:");
    println!("    -h      Display help message");
    println!("    -V      Print version info");
}

fn show_version() {
    println!("uguisu {}", env!("CARGO_PKG_VERSION"));
}

fn run_script(filename: &str) {
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

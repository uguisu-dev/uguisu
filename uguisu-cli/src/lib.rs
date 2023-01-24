use getopts::Options;
use std::env;
use std::fs::File;
use std::io::Read;
use uguisu_engine::Engine;

pub fn parse_command() {
    let mut opts = Options::new();
    opts.optflag("h", "help", "Print this message.");
    opts.optflag("v", "version", "Print Uguisu version.");
    let args: Vec<String> = env::args().collect();
    let matches = match opts.parse(&args[1..]) {
        Ok(x) => x,
        Err(e) => {
            println!("Error: {}", e.to_string());
            return;
        }
    };
    if matches.opt_present("h") {
        show_help(opts);
        return;
    }
    if matches.opt_present("v") {
        show_version();
        return;
    }
    if matches.free.is_empty() {
        show_help(opts);
        return;
    }
    let input = &matches.free[0];
    run_script(input);
}

fn show_help(opts: Options) {
    let brief = "Usage: uguisu [OPTIONS] INPUT";
    print!("{}", opts.usage(brief));
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

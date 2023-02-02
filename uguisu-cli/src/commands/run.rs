use getopts::Options;
use std::fs::File;
use std::io::Read;
use uguisu_engine::Engine;

fn show_help(opts: Options) {
    let lines = [
        "Usage: uguisu run [Options] INPUT",
    ];
    let brief = lines.join("\n");
    print!("{}", opts.usage(brief.as_str()));
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

    let graph = match engine.analyze(&code, ast) {
        Ok(x) => x,
        Err(e) => return println!("SyntaxError: {}", e.message),
    };

    match engine.run(graph) {
        Ok(_) => {}
        Err(e) => return println!("RuntimeError: {}", e.message),
    };
}

pub(crate) fn command(args: &[String]) {
    let mut opts = Options::new();
    opts.optflag("h", "help", "Print help message.");
    let matches = match opts.parse(args) {
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
    if matches.free.is_empty() {
        show_help(opts);
        return;
    }
    let input = &matches.free[0];
    run_script(input);
}

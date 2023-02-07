use getopts::Options;
use std::fs::File;
use std::io::Read;
use uguisu_engine::Engine;

fn show_help(opts: Options) {
    let lines = [
        "Usage: uguisu run [options] [filename]",
        "",
        "Examples:",
        "    uguisu run <filename>",
    ];
    let brief = lines.join("\n");
    print!("{}", opts.usage(brief.as_str()));
}

fn run_script(filename: &str, ast_dump: bool, graph_dump: bool, analyzing_trace: bool, running_trace: bool) {
    let mut file = match File::open(filename) {
        Ok(x) => x,
        Err(_) => return println!("Error: Failed to open the file."),
    };

    let mut code = String::new();
    match file.read_to_string(&mut code) {
        Ok(_) => {}
        Err(_) => return println!("Error: Failed to read the file."),
    };

    let mut engine = Engine::new(analyzing_trace, running_trace);

    let ast = match engine.parse(&code) {
        Ok(x) => x,
        Err(e) => return println!("SyntaxError: {}", e.message),
    };

    if ast_dump {
        println!("== AST dump ===========================================================");
        engine.show_ast(&ast, &code);
    }

    if analyzing_trace {
        println!("== Analyzing trace ====================================================");
    }
    let graph = match engine.analyze(&code, ast) {
        Ok(x) => x,
        Err(e) => return println!("SyntaxError: {}", e.message),
    };

    if graph_dump {
        println!("== Graph dump =========================================================");
        engine.show_graph_map();
    }

    if running_trace {
        println!("== Running trace ======================================================");
    }
    match engine.run(graph) {
        Ok(_) => {}
        Err(e) => return println!("RuntimeError: {}", e.message),
    };
}

pub(crate) fn command(args: &[String]) {
    let mut opts = Options::new();
    opts.optflag("h", "help", "Print help message.");
    opts.optflag("", "ast-dump", "Display a dump of AST.");
    opts.optflag("", "graph-dump", "Display a dump of graph map.");
    opts.optflag("", "analyzing-trace", "Display a trace info of analyzing time.");
    opts.optflag("", "running-trace", "Display a trace info of runing time.");
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
    let ast_dump = matches.opt_present("ast-dump");
    let graph_dump = matches.opt_present("graph-dump");
    let analyzing_trace = matches.opt_present("analyzing-trace");
    let running_trace = matches.opt_present("running-trace");
    let input = &matches.free[0];
    run_script(input, ast_dump, graph_dump, analyzing_trace, running_trace);
}

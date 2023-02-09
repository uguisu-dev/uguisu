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

fn run_script(filename: &str, dump_ast: bool, dump_hir: bool, trace_gen: bool, trace_run: bool) {
    let mut file = match File::open(filename) {
        Ok(x) => x,
        Err(_) => return println!("Error: Failed to open the file."),
    };

    let mut code = String::new();
    match file.read_to_string(&mut code) {
        Ok(_) => {}
        Err(_) => return println!("Error: Failed to read the file."),
    };

    let mut engine = Engine::new(trace_gen, trace_run);

    let ast = match engine.parse(&code) {
        Ok(x) => x,
        Err(e) => return println!("SyntaxError: {}", e.message),
    };

    if dump_ast {
        println!("== AST ================================================================");
        engine.show_ast(&ast, &code);
    }

    if trace_gen {
        println!("== HIR-gen tracing ====================================================");
    }
    let hir_code = match engine.generate_hir(&code, ast) {
        Ok(x) => x,
        Err(e) => return println!("SyntaxError: {}", e.message),
    };

    if dump_hir {
        println!("== HIR map ============================================================");
        engine.show_hir_map();
    }

    if trace_run {
        println!("== Runtime tracing ====================================================");
    }
    match engine.run(hir_code) {
        Ok(_) => {}
        Err(e) => return println!("RuntimeError: {}", e.message),
    };
}

pub(crate) fn command(args: &[String]) {
    let mut opts = Options::new();
    opts.optflag("h", "help", "Print help message.");
    opts.optflag("", "dump-ast", "Display a dump of AST.");
    opts.optflag("", "dump-hir", "Display a dump of HIR map.");
    opts.optflag("", "trace-gen", "Display a trace info of the HIR genaration.");
    opts.optflag("", "trace-run", "Display a trace info of the runtime.");
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
    let dump_ast = matches.opt_present("dump-ast");
    let dump_hir = matches.opt_present("dump-hir");
    let trace_gen = matches.opt_present("trace-gen");
    let trace_run = matches.opt_present("trace-run");
    let input = &matches.free[0];
    run_script(input, dump_ast, dump_hir, trace_gen, trace_run);
}

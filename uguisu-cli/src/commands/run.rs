//! A module for `uguisu run` command.

use getopts::Options;
use std::fs::File;
use std::io::Read;
use uguisu_engine::{
    parse,
    show_ast_data,
    generate_hir,
    show_hir_data,
    run,
};

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
    let filename = &matches.free[0];

    let mut file = match File::open(filename) {
        Ok(x) => x,
        Err(_) => return println!("Error: Failed to open the file."),
    };

    let mut source_code = String::new();
    match file.read_to_string(&mut source_code) {
        Ok(_) => {}
        Err(_) => return println!("Error: Failed to read the file."),
    }
    let ast = match parse(&source_code) {
        Ok(x) => x,
        Err(e) => return println!("SyntaxError: {}", e.message),
    };
    if dump_ast {
        println!("== AST data ===========================================================");
        show_ast_data(&ast);
    }
    if trace_gen {
        println!("== HIR-gen tracing ====================================================");
    }
    let hir = match generate_hir(&ast, trace_gen) {
        Ok(x) => x,
        Err(e) => return println!("SyntaxError: {}", e.message),
    };
    if dump_hir {
        println!("== HIR data ===========================================================");
        show_hir_data(&hir);
    }
    if trace_run {
        println!("== Runtime tracing ====================================================");
    }
    match run(&hir, trace_run) {
        Ok(_) => {}
        Err(e) => return println!("RuntimeError: {}", e.message),
    };
}

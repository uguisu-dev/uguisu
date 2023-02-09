use getopts::Options;

pub(crate) mod run;

fn show_help(opts: Options) {
    let lines = [
        "Usage: uguisu [options] [commands]",
        "",
        "Examples:",
        "    uguisu run <filename>",
        "    uguisu <command> -h",
        "    uguisu -v",
    ];
    let brief = lines.join("\n");
    print!("{}", opts.usage(brief.as_str()));
    let lines = [
        "",
        "Commands:",
        "    run                 Run a script file.",
        "",
    ];
    print!("{}", lines.join("\n"));
}

fn show_version() {
    println!("uguisu {}", env!("CARGO_PKG_VERSION"));
}

pub(crate) fn root_command(args: &[String]) {
    let mut opts = Options::new();
    opts.optflag("h", "help", "Print help message.");
    opts.optflag("v", "version", "Print Uguisu version.");
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
    if matches.opt_present("v") {
        show_version();
        return;
    }
    show_help(opts);
}

use std::env;

mod commands;

enum Command {
    Root,
    Run,
}

pub fn parse_command() {
    let args_source: Vec<String> = env::args().collect();
    let command = if args_source.len() > 1 {
        match args_source[1].as_str() {
            "run" => Some(Command::Run),
            _ => None,
        }
    } else {
        None
    };
    let (command, args) = match command {
        Some(x) => (x, &args_source[2..]),
        None => (Command::Root, &args_source[1..]),
    };
    match command {
        Command::Root => commands::root_command(args),
        Command::Run => commands::run::command(args),
    }
}

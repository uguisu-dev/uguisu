use std::{fs::File, io::Read, env};

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        println!("Error: Please specify a filename.");
        return;
    }

    let filename = &args[1];
    let mut file = match File::open(filename) {
        Ok(file) => file,
        Err(_) => { return println!("Error: Failed to open the file."); },
    };

    let mut code = String::new();
    match file.read_to_string(&mut code) {
        Ok(_) => {},
        Err(_) => { return println!("Error: Failed to read the file."); },
    }

    if let Err(e) = uguisu_engine::run(&code) {
        println!("{}", e);
    };
}

use std::mem;
use crate::inst::InstEmitter;

mod inst;
mod parser;
mod ast;
mod builtin;

pub fn run(code: &str) -> Result<(), String> {
    println!("[Info] parsing ...");
    let nodes = parser::parse(code)
        .map_err(|e| format!("Syntax Error: {}", e.message))?;
    println!("[Info] compiling ...");
    let mut emitter = InstEmitter::new();
    let compiled_func = emitter.emit(&nodes)
        .map_err(|e| format!("Compile Error: {}", e.message))?;
    println!("[Info] running ...");
    let func = unsafe { mem::transmute::<*const u8, fn()>(compiled_func.ptr) };
    func();
    Ok(())
}

#[cfg(test)]
mod test {
    use crate::*;

    #[test]
    fn test_empty_return() {
        assert!(run("
            fn main() {
                return;
            }
        ").is_ok());
    }

    #[test]
    fn text_basic() {
        assert!(run("
            external fn print_num(value: number);
            fn add(x: number, y: number): number {
                return x + y;
            }
            fn main() {
                print_num(add(1, 2) * 3);
            }
        ").is_ok());
    }
}

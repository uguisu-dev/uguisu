use crate::resolve::{Resolver, Scope, Symbol};
use std::mem;

//mod codegen;
mod parse;
mod resolve;

#[derive(Debug, Clone)]
pub struct CompileError {
    pub message: String,
}

impl CompileError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

pub fn run(code: &str) -> Result<(), String> {
    println!("[Info] compiling ...");
    let mut ast = parse::parse(code).map_err(|e| format!("Compile Error: {}", e.message))?;

    let mut symbols: Vec<Symbol> = Vec::new();
    let mut scope = Scope::new();
    Resolver::new(&mut symbols, &mut scope)
        .resolve(&mut ast)
        .map_err(|e| format!("Compile Error: {}", e.message))?;

    // let backend_module = codegen::emit_module(scope).map_err(|e| format!("Compile Error: {}", e.message))?;

    // let func = match backend_module.funcs.iter().find(|x| x.name == "main") {
    //     Some(func) => func,
    //     None => return Err("Compile Error: function 'main' not found".to_string()),
    // };

    // println!("[Info] running ...");
    // let func = unsafe { mem::transmute::<*const u8, fn()>(func.ptr) };
    // func();

    Ok(())
}

#[cfg(test)]
mod test {
    use crate::*;

    fn run_test(code: &str) {
        match run(code) {
            Err(e) => {
                println!("{}", e);
                panic!();
            }
            _ => {}
        }
    }

    #[test]
    fn test_empty_return() {
        run_test(
            "
            fn main() {
                return;
            }
            ",
        );
    }

    #[test]
    fn text_basic() {
        run_test(
            "
            external fn print_num(value: number);
            fn add(x: number, y: number): number {
                return x + y;
            }
            fn square(x: number): number {
                return x * x;
            }
            fn main() {
                print_num(square(add(1, 2) * 3));
            }
            ",
        );
    }
}

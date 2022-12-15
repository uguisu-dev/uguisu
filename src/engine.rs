use std::mem;
use jit::JITCompiler;

mod parser;
mod ast;
mod jit;
mod builtin;

pub fn run(code: &str) {
    let nodes = match parser::parse(code) {
        Ok(nodes) => nodes,
        Err(e) => {
            println!("Syntax Error: {}", e.message);
            return;
        },
    };
    let mut jit = JITCompiler::new();
    match jit.compile(&nodes) {
        Ok(_) => {},
        Err(e) => {
            println!("Compile Error: {}", e.message);
            return;
        },
    }
    match jit.get_func_ptr("main") {
        Ok(func_ptr) => {
            let func = unsafe { mem::transmute::<*const u8, fn()>(func_ptr) };
            func();
        },
        Err(_) => {
            println!("Runtime Error: function 'main' not found");
            return;
        },
    }
}

#[cfg(test)]
mod test {
    #[test]
    fn test_empty_return() {
        super::run("
            fn main() {
                return;
            }
        ");
    }
}

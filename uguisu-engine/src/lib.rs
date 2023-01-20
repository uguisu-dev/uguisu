use std::collections::HashMap;

use crate::run::SymbolTable;

mod analyze;
mod parse;
mod run;

#[derive(Debug, Clone)]
pub struct SyntaxError {
    pub message: String,
}

impl SyntaxError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct RuntimeError {
    pub message: String,
}

impl RuntimeError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

pub fn run(code: &str) -> Result<(), String> {
    println!("[Info] parsing ...");
    let ast = parse::parse(code).map_err(|e| format!("Syntax Error: {}", e.message))?;

    println!("[Info] code analyzing ...");
    let mut graph_source: HashMap<analyze::NodeId, analyze::Node> = HashMap::new();
    let mut analyzer = analyze::Analyzer::new(&mut graph_source);
    let graph = analyzer
        .translate(&ast)
        .map_err(|e| format!("Syntax Error: {}", e.message))?;

    println!("[Info] show graph");
    analyzer.show_graph();

    println!("[Info] running ...");
    let mut symbols = SymbolTable::new();
    let runner = run::Runner::new(&graph_source);
    runner.run(&graph, &mut symbols);

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

    #[test]
    fn text_variable() {
        run_test(
            "
            external fn print_num(value: number);
            fn square(x: number): number {
                return x * x;
            }
            fn main() {
                const var1 = 2;
                print_num(square(var1 * 3));
            }
            ",
        );
        run_test(
            "
            external fn print_num(value: number);
            fn square(x: number): number {
                return x * x;
            }
            fn main() {
                const var1 = square(2 * 3);
                print_num(var1);
            }
            ",
        );
    }
}

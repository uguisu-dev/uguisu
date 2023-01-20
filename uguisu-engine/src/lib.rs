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

    //println!("[Info] show graph");
    //analyzer.show_graph();

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
    fn test_empty_function() {
        run_test(
            "
            fn main() { }
            ",
        );
    }

    #[test]
    fn test_function_basic() {
        run_test(
            "
            fn add(x: number, y: number): number {
                return x + y;
            }
            fn main() {
                add(1, 2);
            }
            ",
        );
    }

    #[test]
    fn test_calc_with_function_1() {
        run_test(
            "
            fn add(x: number, y: number): number {
                return x + y;
            }
            fn square(x: number): number {
                return x * x;
            }
            fn main() {
                add(square(2), 3);
            }
            ",
        );
    }

    #[test]
    fn test_calc_with_function_2() {
        run_test(
            "
            fn square(x: number): number {
                return x * x;
            }
            fn calc(x: number, y: number): number {
                return square(x) + y;
            }
            fn main() {
                calc(2, 3);
            }
            ",
        );
    }

    #[test]
    fn test_variable_basic() {
        run_test(
            "
            fn main() {
                const x = 1 + 2;
            }
            ",
        );
    }

    #[test]
    fn test_calc_with_variable() {
        run_test(
            "
            fn calc(x: number, y: number): number {
                const temp = x + y;
                return temp * temp;
            }
            fn main() {
                const a = 2;
                calc(a, 3);
            }
            ",
        );
    }
}

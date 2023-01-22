use std::collections::HashMap;
use crate::parse;
use crate::analyze;

fn run_analyze(code: &str) -> Result<(), String> {
    let ast = parse::parse(code).map_err(|e| format!("Syntax Error: {}", e.message))?;

    let mut graph_source: HashMap<analyze::NodeId, analyze::Node> = HashMap::new();
    let mut analyzer = analyze::Analyzer::new(&mut graph_source);
    let _graph = analyzer
        .translate(&ast)
        .map_err(|e| format!("Syntax Error: {}", e.message))?;

    //analyzer.show_graph();

    Ok(())
}

fn run_test(code: &str) {
    match run_analyze(code) {
        Err(e) => {
            println!("{}", e);
            panic!();
        }
        _ => {}
    }
}

#[test]
fn test_if_empty() {
    run_test(
        "
        fn main() {
            if true { }
            else if true { }
            else if true { }
            else { }
        }
        ",
    );
}

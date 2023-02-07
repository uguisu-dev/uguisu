use crate::graph;
use crate::Engine;

fn try_run_test(code: &str) -> Result<Vec<graph::NodeRef>, String> {
    let mut engine = Engine::new(false, false);

    let ast = match engine.parse(code) {
        Ok(x) => x,
        Err(e) => return Err(format!("Parser Error: {}", e.message)),
    };

    let graph = match engine.analyze(code, ast) {
        Ok(x) => x,
        Err(e) => return Err(format!("Analyzer Error: {}", e.message)),
    };

    // engine.show_graph_map();

    Ok(graph)
}

fn run_test(code: &str) {
    try_run_test(code).unwrap();
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

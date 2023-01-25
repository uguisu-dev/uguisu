use crate::analyze;
use crate::Engine;

fn try_run_test(code: &str) -> Result<Vec<analyze::NodeRef>, String> {
    let mut engine = Engine::new();

    // println!("[Info] parsing ...");
    let ast = match engine.parse(code) {
        Ok(x) => x,
        Err(e) => return Err(format!("ParseError: {}", e.message)),
    };

    // println!("[Info] code analyzing ...");
    let graph = match engine.analyze(ast) {
        Ok(x) => x,
        Err(e) => return Err(format!("AnalyzeError: {}", e.message)),
    };

    // println!("[Info] show graph map");
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

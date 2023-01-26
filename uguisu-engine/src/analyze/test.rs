use crate::analyze;
use crate::Engine;

fn try_run_test(code: &str) -> Result<Vec<analyze::NodeRef>, String> {
    let mut engine = Engine::new();

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

#[test]
fn test_location_single_line() {
    let input = "";
    match analyze::Analyzer::calc_location(input, 0) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
    let input = "a";
    match analyze::Analyzer::calc_location(input, 0) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
    match analyze::Analyzer::calc_location(input, 1) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    match analyze::Analyzer::calc_location(input, 1) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    let input = "ab";
    match analyze::Analyzer::calc_location(input, 1) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    match analyze::Analyzer::calc_location(input, 2) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 3);
        }
        Err(_) => panic!(),
    }
}

#[test]
fn test_location_multiline_lf() {
    let input = "a\nb";
    match analyze::Analyzer::calc_location(input, 1) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    match analyze::Analyzer::calc_location(input, 2) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
    match analyze::Analyzer::calc_location(input, 3) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    let input = "a\n\nb";
    match analyze::Analyzer::calc_location(input, 3) {
        Ok((line, column)) => {
            assert_eq!(line, 3);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
}

#[test]
fn test_location_multiline_crlf() {
    let input = "a\r\nb";
    match analyze::Analyzer::calc_location(input, 1) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    match analyze::Analyzer::calc_location(input, 3) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
    match analyze::Analyzer::calc_location(input, 4) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    let input = "a\r\n\r\nb";
    match analyze::Analyzer::calc_location(input, 5) {
        Ok((line, column)) => {
            assert_eq!(line, 3);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
}

#[test]
fn test_location_multiline_cr() {
    let input = "a\rb";
    match analyze::Analyzer::calc_location(input, 1) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    match analyze::Analyzer::calc_location(input, 2) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
    match analyze::Analyzer::calc_location(input, 3) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    let input = "a\r\rb";
    match analyze::Analyzer::calc_location(input, 3) {
        Ok((line, column)) => {
            assert_eq!(line, 3);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
}

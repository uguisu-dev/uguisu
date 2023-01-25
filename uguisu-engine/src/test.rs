use crate::Engine;

fn try_run_test(code: &str) -> Result<(), String> {
    let mut engine = Engine::new();

    let ast = match engine.parse(code) {
        Ok(x) => x,
        Err(e) => return Err(format!("Parser Error: {}", e.message)),
    };

    let graph = match engine.analyze(ast) {
        Ok(x) => x,
        Err(e) => return Err(format!("Analyzer Error: {}", e.message)),
    };

    // engine.show_graph_map();

    match engine.run(graph) {
        Ok(x) => Ok(x),
        Err(e) => return Err(format!("Runner Error: {}", e.message)),
    }
}

fn run_test(code: &str) {
    try_run_test(code).unwrap();
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
            assert_eq(add(1, 2), 3);
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
            assert_eq(add(square(2), 3), 7);
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
            assert_eq(calc(2, 3), 7);
        }
        ",
    );
}

#[test]
fn test_function_recursion() {
    run_test(
        "
        fn calc(x: number): number {
            if x == 0 {
                return 1;
            } else {
                return calc(x - 1) * 2;
            }
        }
        fn main() {
            assert_eq(calc(8), 256);
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
            assert_eq(x, 3);
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
            assert_eq(calc(a, 3), 25);
        }
        ",
    );
}

#[test]
fn test_loop_statement() {
    run_test(
        "
        fn main() {
            let i = 0;
            let x = 1;
            loop {
                if i == 10 { break; }
                x = x * 2;
                i = i + 1;
            }
            assert_eq(x, 1024);
        }
        ",
    );
}

#[test]
fn test_bool() {
    run_test(
        "
        fn f(value: bool): bool {
            return value;
        }
        fn main() {
            const a = true;
            const b = false;
            const c = f(true);
        }
        ",
    );
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
fn test_relational_op() {
    run_test(
        "
        fn main() {
            let x = 0;
            if 1 + 2 == 3 {
                x = 1;
            }
            assert_eq(x, 1);
        }
        ",
    );
}

#[test]
fn test_break_no_target() {
    let result = try_run_test(
        "
        fn main() {
            break;
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn test_break_no_target_nested() {
    let result = try_run_test(
        "
        fn main() {
            let x = true;
            if x {
                break;
            }
        }
        ",
    );
    assert!(result.is_err());
}

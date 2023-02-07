use crate::Engine;

fn try_run_test(code: &str) -> Result<(), String> {
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
            var x = 1 + 2;
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
            var temp = x + y;
            return temp * temp;
        }
        fn main() {
            var a = 2;
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
            var i = 0;
            var x = 1;
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
            var a = true;
            var b = false;
            var c = f(true);
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
            var x = 0;
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
            var x = true;
            if x {
                break;
            }
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn test_assignment() {
    run_test(
        "
        fn main() {
            var x = 0;
            assert_eq(x, 0);
            x = 1;
            assert_eq(x, 1);
            x = 2;
            assert_eq(x, 2);
        }
        ",
    );
}

#[test]
fn test_assignment_modes() {
    run_test(
        "
        fn main() {
            var x = 0;
            assert_eq(x, 0);
            x += 10;
            assert_eq(x, 10);
            x -= 2;
            assert_eq(x, 8);
            x *= 2;
            assert_eq(x, 16);
            x /= 4;
            assert_eq(x, 4);
        }
        ",
    );
}

#[test]
fn should_generate_error_with_function_name_1() {
    let result = try_run_test(
        "
        fn main() {
            main = 1;
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn should_generate_error_with_function_name_2() {
    let result = try_run_test(
        "
        fn main() {
            var x = 1;
            x = main;
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn should_generate_error_with_function_name_3() {
    let result = try_run_test(
        "
        fn main() {
            var x = main;
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn should_generate_error_with_function_name_4() {
    let result = try_run_test(
        "
        fn f(): number {
            return f;
        }
        fn main() {
            f();
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn should_generate_error_with_function_name_5() {
    let result = try_run_test(
        "
        fn main() {
            if main == main { }
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn should_generate_error_with_function_name_6() {
    let result = try_run_test(
        "
        fn main() {
            main;
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn should_generate_error_with_function_name_7() {
    let result = try_run_test(
        "
        fn main() {
            const x = !main;
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn should_generate_error_with_function_name_8() {
    let result = try_run_test(
        "
        fn main() {
            const x = main + main;
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn should_generate_error_with_function_name_9() {
    let result = try_run_test(
        "
        fn main() {
            const x = main == main;
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn should_generate_error_with_function_name_10() {
    let result = try_run_test(
        "
        fn main() {
            const x = main && main;
        }
        ",
    );
    assert!(result.is_err());
}

#[test]
fn should_generate_error_with_function_name_11() {
    let result = try_run_test(
        "
        fn f() {
        }
        fn main() {
            var x = f(main);
        }
        ",
    );
    assert!(result.is_err());
}

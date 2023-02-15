
fn try_run_test(source_code: &str) -> Result<(), String> {
    let ast_data = crate::parse(source_code)
        .map_err(|e| format!("Parsing Error: {}", e.message))?;

    let hir_data = crate::generate_hir(&ast_data, false)
        .map_err(|e| format!("Analysis Error: {}", e.message))?;

    crate::run(&hir_data, false)
        .map_err(|e| format!("Runtime Error: {}", e.message))
}

fn run_test(source_code: &str) {
    try_run_test(source_code).unwrap();
}

// variable + number literal

#[test]
fn test_variable_arith_1() {
    run_test(
        "
        fn main() {
            var x = 1;
            assertEq(x, 1);
        }
        ",
    );
}

#[test]
fn test_variable_arith_2() {
    run_test(
        "
        fn main() {
            var x = 1 + 2;
            assertEq(x, 3);
        }
        ",
    );
}

// function declaration

#[test]
fn test_function_empty() {
    run_test(
        "
        fn main() {
        }
        ",
    );
}

#[test]
fn test_function_calc() {
    run_test(
        "
        fn add(x: number, y: number): number {
            return x + y;
        }
        fn main() {
            assertEq(add(1, 2), 3);
        }
        ",
    );
}

#[test]
fn test_subrutine() {
    run_test(
        "
        fn subrutine(x: number) {
            var y = x + x;
            var z = y + 1;
            assertEq(z, 7);
        }
        fn main() {
            var x = 1;
            x += 2;
            subrutine(x);
        }
        ",
    );
}

// function call

#[test]
fn test_call_function_1() {
    run_test(
        "
        fn add(x: number, y: number): number {
            return x + y;
        }
        fn square(x: number): number {
            return x * x;
        }
        fn main() {
            assertEq(add(square(2), 3), 7);
        }
        ",
    );
}

#[test]
fn test_call_function_2() {
    run_test(
        "
        fn square(x: number): number {
            return x * x;
        }
        fn calc(x: number, y: number): number {
            return square(x) + y;
        }
        fn main() {
            assertEq(calc(2, 3), 7);
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
            assertEq(calc(8), 256);
        }
        ",
    );
}

// function params

#[test]
fn test_calc_with_func_param() {
    run_test(
        "
        fn calc(x: number, y: number): number {
            var temp = x + y;
            return temp * temp;
        }
        fn main() {
            var a = 2;
            assertEq(calc(a, 3), 25);
        }
        ",
    );
}

// return function

#[test]
fn test_return_function() {
    run_test(
        "
        fn gen_result(x: number): number {
            if (x != 3) {
                return 0;
            }
            return 1;
        }
        fn main() {
            assertEq(gen_result(1), 0);
            assertEq(gen_result(2), 0);
            assertEq(gen_result(3), 1);
            assertEq(gen_result(4), 0);
        }
        ",
    );
}

// if + if-else + if-elseif-else + bool literal

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
fn test_if() {
    run_test(
        "
        fn main() {
            var x = 0;
            if true {
                x = 1;
            }
            assertEq(x, 1);
            if false {
                x = 2;
            }
            assertEq(x, 1);
        }
        ",
    );
}

#[test]
fn test_if_else() {
    run_test(
        "
        fn main() {
            var x = 1;
            if true {
                x = 2;
            } else {
                x = 3;
            }
            assertEq(x, 2);
            if false {
                x = 4;
            } else {
                x = 5;
            }
            assertEq(x, 5);
        }
        ",
    );
}

#[test]
fn test_if_elseif_else() {
    run_test(
        "
        fn main() {
            var x = 1;
            if true {
                x = 2;
            } else if false {
                x = 3;
            } else {
                x = 4;
            }
            assertEq(x, 2);
            if false {
                x = 2;
            } else if true {
                x = 3;
            } else {
                x = 4;
            }
            assertEq(x, 3);
            if false {
                x = 3;
            } else if false {
                x = 4;
            } else {
                x = 5;
            }
            assertEq(x, 5);
        }
        ",
    );
}

// logical operation

#[test]
fn test_logical_op_1() {
    run_test(
        "
        fn main() {
            var x = 1;
            if true && false {
                x = 2;
            }
            assertEq(x, 1);
            if true && true {
                x = 3;
            }
            assertEq(x, 3);
            if false || false {
                x = 4;
            }
            assertEq(x, 3);
            if false || true {
                x = 5;
            }
            assertEq(x, 5);
            if false && true || true && true {
                x = 6;
            }
            assertEq(x, 6);
        }
        ",
    );
}

#[test]
fn test_logical_op_2() {
    run_test(
        "
        fn main() {
            var x = 1;
            if false && true || true && true {
                x = 2;
            }
            assertEq(x, 2);
        }
        ",
    );
}

#[test]
fn test_logical_op_3() {
    run_test(
        "
        fn main() {
            var x = 1;
            if !false {
                x = 2;
            }
            assertEq(x, 2);
        }
        ",
    );
}

// arithmetic comparison

#[test]
fn test_arith_comp_1() {
    run_test(
        "
        fn main() {
            var x = 1;
            if x == 1 {
                x = 2;
            }
            assertEq(x, 2);
            if x == 1 {
                x = 3;
            }
            assertEq(x, 2);
        }
        ",
    );
}

#[test]
fn test_arith_comp_2() {
    run_test(
        "
        fn main() {
            var x = 1;
            if 1 + 2 == 3 {
                x = 2;
            }
            assertEq(x, 2);
            if 2 - 1 == 0 {
                x = 3;
            }
            assertEq(x, 2);
        }
        ",
    );
}

// loop

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
            assertEq(x, 1024);
        }
        ",
    );
}

// break

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

// assignment

#[test]
fn test_assignment() {
    run_test(
        "
        fn main() {
            var x = 0;
            assertEq(x, 0);
            x = 1;
            assertEq(x, 1);
            x = 2;
            assertEq(x, 2);
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
            assertEq(x, 0);
            x += 10;
            assertEq(x, 10);
            x -= 2;
            assertEq(x, 8);
            x *= 2;
            assertEq(x, 16);
            x /= 4;
            assertEq(x, 4);
        }
        ",
    );
}

// function identifier

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
            var x = !main;
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
            var x = main + main;
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
            var x = main == main;
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
            var x = main && main;
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

// comments

#[test]
fn test_comment() {
    run_test(
        "
        // main function
        //
        // this function is entry point of program
        fn main() {
            /*
             * write
             * your code
             * here
            */
        }
        ",
    );
}

// string

#[test]
fn test_string_literal() {
    run_test(
        "
        fn make_message(): string {
            var message: string = \"hello\";
            return message;
        }
        fn main() {
            var x: string = make_message();
        }
        ",
    );
}

// other examples

#[test]
fn test_example() {
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
            var value = 10;
            assertEq(calc(value), 1024);
        }
        ",
    );
}

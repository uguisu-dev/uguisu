use crate::parse::*;

#[test]
fn test_digit() {
    if !uguisu_parser::expression("0").is_ok() {
        panic!("incorrect result");
    }

    if !uguisu_parser::expression("1").is_ok() {
        panic!("incorrect result");
    }

    if !uguisu_parser::expression("9").is_ok() {
        panic!("incorrect result");
    }
}

#[test]
fn test_digits() {
    if !uguisu_parser::expression("12").is_ok() {
        panic!("incorrect result");
    }

    if !uguisu_parser::expression("89").is_ok() {
        panic!("incorrect result");
    }

    if !uguisu_parser::expression("1234567").is_ok() {
        panic!("incorrect result");
    }

    if uguisu_parser::expression("01").is_ok() {
        panic!("incorrect result");
    }
}

#[test]
fn test_calc() {
    let actual = uguisu_parser::expression("1+2*(3+4)/5");
    let expect = Ok(Node::new_binary_expr("+",
        Node::new_number(1, 0),
        Node::new_binary_expr("/",
            Node::new_binary_expr("*",
                Node::new_number(2, 2),
                Node::new_binary_expr("+",
                    Node::new_number(3, 5),
                    Node::new_number(4, 7),
                    6,
                ),
                3,
            ),
            Node::new_number(5, 10),
            9,
        ),
        1,
    ));
    if actual != expect {
        panic!("assert error");
    }
}

#[test]
fn test_declare_func_no_annotations() {
    let expect = Ok(Node::new_function_declaration(
        "abc".to_string(),
        Some(vec![]),
        vec![],
        None,
        vec![],
        0,
    ));
    if uguisu_parser::statement("fn abc() { }") != expect {
        panic!("assert error");
    }
    if uguisu_parser::statement("fn abc(){}") != expect {
        panic!("assert error");
    }
    if uguisu_parser::statement("fn  abc(  )  {  }") != expect {
        panic!("assert error");
    }
    if uguisu_parser::statement("fnabc(){}").is_ok() {
        panic!("assert error");
    }
}

#[test]
fn test_declare_func_with_types_1() {
    let expect = Ok(Node::new_function_declaration(
        "abc".to_string(),
        Some(vec![]),
        vec![
            Node::new_func_param("x".to_string(), Some("number".to_string()), 7),
            Node::new_func_param("y".to_string(), Some("number".to_string()), 18),
        ],
        Some("number".to_string()),
        vec![],
        0,
    ));

    if uguisu_parser::statement("fn abc(x: number, y: number): number { }") != expect {
        panic!("assert error");
    }
}

#[test]
fn test_declare_func_with_types_2() {
    let expect = Ok(Node::new_function_declaration(
        "abc".to_string(),
        Some(vec![]),
        vec![
            Node::new_func_param("x".to_string(), Some("number".to_string()), 7),
            Node::new_func_param("y".to_string(), Some("number".to_string()), 16),
        ],
        Some("number".to_string()),
        vec![],
        0,
    ));

    if uguisu_parser::statement("fn abc(x:number,y:number):number{}") != expect {
        panic!("assert error");
    }
}

#[test]
fn test_declare_func_with_types_3() {
    let expect = Ok(Node::new_function_declaration(
        "abc".to_string(),
        Some(vec![]),
        vec![
            Node::new_func_param("x".to_string(), Some("number".to_string()), 12),
            Node::new_func_param("y".to_string(), Some("number".to_string()), 29),
        ],
        Some("number".to_string()),
        vec![],
        0,
    ));

    if uguisu_parser::statement("fn  abc  (  x  :  number  ,  y  :  number  )  :  number  {  }") != expect {
        panic!("assert error");
    }
}

#[test]
fn test_declare_func_with_types_4() {
    assert!(uguisu_parser::statement("fnabc(x:number,y:number):number{}").is_err());
}

#[test]
fn test_identifier_single_ascii() {
    if let Ok(Node::Reference(Reference { identifier, pos: 0, .. })) = uguisu_parser::expression("a") {
        assert_eq!(identifier, "a");
    } else {
        panic!("incorrect result 1");
    }

    if let Ok(Node::Reference(Reference { identifier, pos: 0, .. })) = uguisu_parser::expression("z") {
        assert_eq!(identifier, "z");
    } else {
        panic!("incorrect result 2");
    }

    if let Ok(Node::Reference(Reference { identifier, pos: 0, .. })) = uguisu_parser::expression("_") {
        assert_eq!(identifier, "_");
    } else {
        panic!("incorrect result 3");
    }

    if let Ok(_) = uguisu_parser::expression("$") {
        panic!("incorrect result 4");
    }
}

#[test]
fn test_identifier_multi_ascii() {
    if let Ok(Node::Reference(Reference { identifier, pos: 0, .. })) = uguisu_parser::expression("abc") {
        assert_eq!(identifier, "abc");
    } else {
        panic!("incorrect result");
    }

    if let Ok(_) = uguisu_parser::expression("0ab") {
        panic!("incorrect result");
    }
}

#[test]
fn test_identifier_multi_byte() {
    if let Ok(Node::Reference(Reference { identifier, pos: 0, .. })) = uguisu_parser::expression("あ") {
        assert_eq!(identifier, "あ");
    } else {
        panic!("incorrect result");
    }

    if let Ok(Node::Reference(Reference { identifier, pos: 0, .. })) = uguisu_parser::expression("変数1") {
        assert_eq!(identifier, "変数1");
    } else {
        panic!("incorrect result");
    }
}

#[test]
fn test_location_single_line() {
    let input = "";
    match calc_location(0, input) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
    let input = "a";
    match calc_location(0, input) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
    match calc_location(1, input) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    match calc_location(1, input) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    let input = "ab";
    match calc_location(1, input) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    match calc_location(2, input) {
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
    match calc_location(1, input) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    match calc_location(2, input) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
    match calc_location(3, input) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    let input = "a\n\nb";
    match calc_location(3, input) {
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
    match calc_location(1, input) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    match calc_location(3, input) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
    match calc_location(4, input) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    let input = "a\r\n\r\nb";
    match calc_location(5, input) {
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
    match calc_location(1, input) {
        Ok((line, column)) => {
            assert_eq!(line, 1);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    match calc_location(2, input) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
    match calc_location(3, input) {
        Ok((line, column)) => {
            assert_eq!(line, 2);
            assert_eq!(column, 2);
        }
        Err(_) => panic!(),
    }
    let input = "a\r\rb";
    match calc_location(3, input) {
        Ok((line, column)) => {
            assert_eq!(line, 3);
            assert_eq!(column, 1);
        }
        Err(_) => panic!(),
    }
}

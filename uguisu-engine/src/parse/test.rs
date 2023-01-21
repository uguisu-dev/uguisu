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
    let expect = Ok(add_operation(
        number(1),
        div_operation(
            mult_operation(number(2), add_operation(number(3), number(4))),
            number(5),
        ),
    ));
    assert_eq!(actual, expect);
}

#[test]
fn test_declare_func_no_annotations() {
    let expect = Ok(function_declaration(
        "abc".to_string(),
        Some(vec![]),
        vec![],
        None,
        vec![],
    ));
    assert_eq!(uguisu_parser::statement("fn abc() { }"), expect);
    assert_eq!(uguisu_parser::statement("fn abc(){}"), expect);
    assert_eq!(uguisu_parser::statement("fn  abc(  )  {  }"), expect);

    assert!(uguisu_parser::statement("fnabc(){}").is_err());
}

#[test]
fn test_declare_func_with_types() {
    let expect = Ok(function_declaration(
        "abc".to_string(),
        Some(vec![]),
        vec![
            parameter("x".to_string(), Some("number".to_string())),
            parameter("y".to_string(), Some("number".to_string())),
        ],
        Some("number".to_string()),
        vec![],
    ));
    assert_eq!(
        uguisu_parser::statement("fn abc(x: number, y: number): number { }"),
        expect
    );
    assert_eq!(
        uguisu_parser::statement("fn abc(x:number,y:number):number{}"),
        expect
    );
    assert_eq!(
        uguisu_parser::statement(
            "fn  abc  (  x  :  number  ,  y  :  number  )  :  number  {  }"
        ),
        expect
    );

    assert!(uguisu_parser::statement("fnabc(x:number,y:number):number{}").is_err());
}

#[test]
fn test_identifier_single_ascii() {
    if let Ok(Node::Reference(Reference { identifier, .. })) = uguisu_parser::expression("a") {
        assert_eq!(identifier, "a");
    } else {
        panic!("incorrect result 1");
    }

    if let Ok(Node::Reference(Reference { identifier, .. })) = uguisu_parser::expression("z") {
        assert_eq!(identifier, "z");
    } else {
        panic!("incorrect result 2");
    }

    if let Ok(Node::Reference(Reference { identifier, .. })) = uguisu_parser::expression("_") {
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
    if let Ok(Node::Reference(Reference { identifier, .. })) = uguisu_parser::expression("abc") {
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
    if let Ok(Node::Reference(Reference { identifier, .. })) = uguisu_parser::expression("あ") {
        assert_eq!(identifier, "あ");
    } else {
        panic!("incorrect result");
    }

    if let Ok(Node::Reference(Reference { identifier, .. })) = uguisu_parser::expression("変数1") {
        assert_eq!(identifier, "変数1");
    } else {
        panic!("incorrect result");
    }
}

use super::ast::*;

// NOTE: The ** operator may have bugs. Therefore, the ++ operator is used.

peg::parser! {
    grammar uguisu_parser() for str {
        pub rule root() -> Vec<Statement>
            = __* s:statements()? __* { if let Some(v) = s { v } else { vec![] } }

        rule statements() -> Vec<Statement>
            = statement() ++ (__*)

        pub rule statement() -> Statement
            = declaration_func()
            / return_statement()
            // / declaration_var()
            / e:expr() __* ";" { Statement::ExprStatement(e) }

        pub rule expr() -> Expression = precedence! {
            // left:(@) __* "==" __* right:@ { Expression::eq(left, right) }
            // left:(@) __* "!=" __* right:@ { Expression::ne(left, right) }
            // --
            // left:(@) __* "<" __* right:@ { Expression::lt(left, right) }
            // left:(@) __* "<=" __* right:@ { Expression::lte(left, right) }
            // left:(@) __* ">" __* right:@ { Expression::gt(left, right) }
            // left:(@) __* ">=" __* right:@ { Expression::gte(left, right) }
            // --
            left:(@) __* "+" __* right:@ { Expression::add(left, right) }
            left:(@) __* "-" __* right:@ { Expression::sub(left, right) }
            --
            left:(@) __* "*" __* right:@ { Expression::mult(left, right) }
            left:(@) __* "/" __* right:@ { Expression::div(left, right) }
            // left:(@) __* "%" __* right:@ { Expression::mod(left, right) }
            --
            // "!" __* right:(@) { right }
            // "+" __* right:(@) { right }
            // "-" __* right:(@) { Expression::mult(Expression::number(-1), right) }
            // --
            e:number() { e }
            e:call() { e }
            //id:idenfitier() { Expression::identifier(id) }
            "(" __* e:expr() __* ")" { e }
        }

        rule declaration_func() -> Statement =
            attrs:dec_func_attrs()? "fn" __+ name:idenfitier() __* "(" __* params:dec_func_params()? __* ")" __* ret:dec_func_return_type()? __*
            body:dec_func_body()
        {
            let params = if let Some(v) = params { v } else { vec![] };
            let attrs = if let Some(v) = attrs { v } else { vec![] };
            Statement::func_declaration(name, params, ret, body, attrs)
        }

        rule dec_func_params() -> Vec<FuncParam>
            = dec_func_param() ++ (__* "," __*)

        rule dec_func_param() -> FuncParam
            = name:idenfitier() type_name:(__* ":" __* n:idenfitier() { n.to_string() })? { FuncParam { name: name.to_string(), type_name } }

        rule dec_func_return_type() -> String
            = ":" __* type_name:idenfitier() { type_name.to_string() }

        rule dec_func_body() -> Option<Vec<Statement>>
            = "{" __* s:statements()? __* "}" { Some(if let Some(v) = s { v } else { vec![] }) }
            / ";" { None }

        rule dec_func_attrs() -> Vec<FuncAttribute>
            = attrs:(dec_func_attr() ++ (__+)) __+ { attrs }

        rule dec_func_attr() -> FuncAttribute
            = "external" { FuncAttribute::External }

        rule return_statement() -> Statement
            = "return" e2:(__+ e1:expr() { e1 })? __* ";"
        {
            if let Some(v) = e2 {
                Statement::return_statement_with_value(v)
            } else {
                Statement::return_statement()
            }
        }

        // rule declaration_var() -> Node
        //     = kind:("let" {DeclarationAttr::Let} / "const" {DeclarationAttr::Const}) __+ id:idenfitier() __* "=" __* def:expr() ";"
        // { Node::declaration(id, vec![kind], def) }

        rule number() -> Expression
            = n:$(['1'..='9'] ['0'..='9']+) {? n.parse().or(Err("u32")).and_then(|n| Ok(Expression::number(n))) }
            / n:$(['0'..='9']) {? n.parse().or(Err("u32")).and_then(|n| Ok(Expression::number(n))) }

        rule call() -> Expression
            = name:idenfitier() __* "(" __* args:call_params()? __* ")"
        {
            let args = if let Some(v) = args { v } else { vec![] };
            Expression::call(name, args)
        }

        rule call_params() -> Vec<Expression>
            = expr() ++ (__* "," __*)

        rule idenfitier() -> &'input str
            = !['0'..='9'] s:$(identifier_char()+) { s }

        rule identifier_char() -> char
            = &['\u{00}'..='\u{7F}'] c:['A'..='Z'|'a'..='z'|'0'..='9'|'_'] { c }
            / !['\u{00}'..='\u{7F}'] c:[_] { c }

        rule __() -> char
            = quiet! { c:[' '|'\t'|'\r'|'\n'] { c } }
    }
}

#[derive(Debug)]
pub struct ParserError {
    pub message: String,
}

impl ParserError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

pub fn parse(input: &str) -> Result<Vec<Statement>, ParserError> {
    match uguisu_parser::root(input) {
        Ok(n) => Ok(n),
        Err(e) => Err(ParserError::new(
            format!("expects {}. ({})", e.expected, e.location).as_str(),
        )),
    }
}

#[cfg(test)]
mod test {
    use super::uguisu_parser;
    use crate::engine::ast::*;

    #[test]
    fn test_digit() {
        if !uguisu_parser::expr("0").is_ok() {
            panic!("incorrect result");
        }

        if !uguisu_parser::expr("1").is_ok() {
            panic!("incorrect result");
        }

        if !uguisu_parser::expr("9").is_ok() {
            panic!("incorrect result");
        }
    }

    #[test]
    fn test_digits() {
        if !uguisu_parser::expr("12").is_ok() {
            panic!("incorrect result");
        }

        if !uguisu_parser::expr("89").is_ok() {
            panic!("incorrect result");
        }

        if !uguisu_parser::expr("1234567").is_ok() {
            panic!("incorrect result");
        }

        if uguisu_parser::expr("01").is_ok() {
            panic!("incorrect result");
        }
    }

    #[test]
    fn test_calc() {
        let actual = uguisu_parser::expr("1+2*(3+4)/5");
        let expect = Ok(Expression::add(
            Expression::number(1),
            Expression::div(
                Expression::mult(
                    Expression::number(2),
                    Expression::add(Expression::number(3), Expression::number(4)),
                ),
                Expression::number(5),
            ),
        ));
        assert_eq!(actual, expect);
    }

    #[test]
    fn test_declare_func_no_annotations() {
        let expect = Ok(Statement::func_declaration(
            "abc",
            vec![],
            None,
            Some(vec![]),
            vec![],
        ));
        assert_eq!(uguisu_parser::statement("fn abc() { }"), expect);
        assert_eq!(uguisu_parser::statement("fn abc(){}"), expect);
        assert_eq!(uguisu_parser::statement("fn  abc(  )  {  }"), expect);

        assert!(uguisu_parser::statement("fnabc(){}").is_err());
    }

    #[test]
    fn test_declare_func_with_types() {
        let expect = Ok(Statement::func_declaration(
            "abc",
            vec![
                FuncParam { name: "x".to_string(), type_name: Some("number".to_string()) },
                FuncParam { name: "y".to_string(), type_name: Some("number".to_string()) },
            ],
            Some("number".to_string()),
            Some(vec![]),
            vec![],
        ));
        assert_eq!(uguisu_parser::statement("fn abc(x: number, y: number): number { }"), expect);
        assert_eq!(uguisu_parser::statement("fn abc(x:number,y:number):number{}"), expect);
        assert_eq!(uguisu_parser::statement("fn  abc  (  x  :  number  ,  y  :  number  )  :  number  {  }"), expect);

        assert!(uguisu_parser::statement("fnabc(x:number,y:number):number{}").is_err());
    }

    // #[test]
    // fn test_identifier_single_ascii() {
    //     if let Ok(Expression::Identifier(name)) = uguisu_parser::expr("a") {
    //         assert_eq!(name, "a");
    //     } else {
    //         panic!("incorrect result 1");
    //     }

    //     if let Ok(Expression::Identifier(name)) = uguisu_parser::expr("z") {
    //         assert_eq!(name, "z");
    //     } else {
    //         panic!("incorrect result 2");
    //     }

    //     if let Ok(Expression::Identifier(name)) = uguisu_parser::expr("_") {
    //         assert_eq!(name, "_");
    //     } else {
    //         panic!("incorrect result 3");
    //     }

    //     if let Ok(_) = uguisu_parser::expr("$") {
    //         panic!("incorrect result 4");
    //     }
    // }

    // #[test]
    // fn test_identifier_multi_ascii() {
    //     if let Ok(Node::Identifier(name)) = uguisu_parser::expr("abc") {
    //         assert_eq!(name, "abc");
    //     } else {
    //         panic!("incorrect result");
    //     }

    //     if let Ok(_) = uguisu_parser::expr("0ab") {
    //         panic!("incorrect result");
    //     }
    // }

    // #[test]
    // fn test_identifier_multi_byte() {
    //     if let Ok(Node::Identifier(name)) = uguisu_parser::expr("あ") {
    //         assert_eq!(name, "あ");
    //     } else {
    //         panic!("incorrect result");
    //     }

    //     if let Ok(Node::Identifier(name)) = uguisu_parser::expr("変数1") {
    //         assert_eq!(name, "変数1");
    //     } else {
    //         panic!("incorrect result");
    //     }
    // }
}

use crate::ast;
use crate::ast::{
    Statement, Expression, Operator, Parameter, FunctionAttribute, VariableAttribute
};

// NOTE: The ** operator may have bugs. Therefore, the ++ operator is used.

peg::parser! {
    grammar uguisu_parser() for str {
        pub rule root() -> Vec<Statement>
            = __* s:statements()? __* { if let Some(v) = s { v } else { vec![] } }

        rule statements() -> Vec<Statement>
            = statement() ++ (__*)

        pub rule statement() -> Statement
            = function_declaration()
            / return_statement()
            / variable_declaration()
            / assignment()
            / e:expression() __* ";" { Statement::ExprStatement(e) }

        pub rule expression() -> Expression = precedence! {
            // left:(@) __* "==" __* right:@ { Expression::eq(left, right) }
            // left:(@) __* "!=" __* right:@ { Expression::ne(left, right) }
            // --
            // left:(@) __* "<" __* right:@ { Expression::lt(left, right) }
            // left:(@) __* "<=" __* right:@ { Expression::lte(left, right) }
            // left:(@) __* ">" __* right:@ { Expression::gt(left, right) }
            // left:(@) __* ">=" __* right:@ { Expression::gte(left, right) }
            // --
            left:(@) __* "+" __* right:@ { ast::binary_expr(Operator::Add, left, right) }
            left:(@) __* "-" __* right:@ { ast::binary_expr(Operator::Sub, left, right) }
            --
            left:(@) __* "*" __* right:@ { ast::binary_expr(Operator::Mult, left, right) }
            left:(@) __* "/" __* right:@ { ast::binary_expr(Operator::Div, left, right) }
            // left:(@) __* "%" __* right:@ { Expression::mod(left, right) }
            --
            // "!" __* right:(@) { right }
            // "+" __* right:(@) { right }
            // "-" __* right:(@) { Expression::mult(Expression::number(-1), right) }
            // --
            e:number() { e }
            e:call_expr() { e }
            id:idenfitier() { Expression::Identifier(id.to_string()) }
            "(" __* e:expression() __* ")" { e }
        }

        rule function_declaration() -> Statement =
            attrs:func_dec_attrs()? "fn" __+ name:idenfitier() __* "(" __* params:func_dec_params()? __* ")" __* ret:func_dec_return_type()? __*
            body:func_dec_body()
        {
            let params = if let Some(v) = params { v } else { vec![] };
            let attrs = if let Some(v) = attrs { v } else { vec![] };
            ast::function_declaration(name.to_string(), body, params, ret, attrs)
        }

        rule func_dec_params() -> Vec<Parameter>
            = func_dec_param() ++ (__* "," __*)

        rule func_dec_param() -> Parameter
            = name:idenfitier() type_name:(__* ":" __* n:idenfitier() { n.to_string() })?
        { ast::parameter(name.to_string(), type_name) }

        rule func_dec_return_type() -> String
            = ":" __* type_name:idenfitier() { type_name.to_string() }

        rule func_dec_body() -> Option<Vec<Statement>>
            = "{" __* s:statements()? __* "}" { Some(if let Some(v) = s { v } else { vec![] }) }
            / ";" { None }

        rule func_dec_attrs() -> Vec<FunctionAttribute>
            = attrs:(func_dec_attr() ++ (__+)) __+ { attrs }

        rule func_dec_attr() -> FunctionAttribute
            = "external" { FunctionAttribute::External }

        rule return_statement() -> Statement
            = "return" e2:(__+ e1:expression() { e1 })? __* ";" { Statement::ReturnStatement(e2) }

        rule variable_declaration() -> Statement
            = kind:(
                "let" {VariableAttribute::Let} / "const" {VariableAttribute::Const}
            ) __+ id:idenfitier() __* "=" __* e:expression() ";"
        { ast::variable_declaration(id.to_string(), e, vec![kind]) }

        rule assignment() -> Statement
            = id:idenfitier() __* "=" __* e:expression() ";"
        { ast::assignment(id.to_string(), e) }

        rule number() -> Expression
            = n:$(['1'..='9'] ['0'..='9']+)
        {? n.parse().or(Err("u32")).and_then(|n| Ok(ast::number(n))) }
            / n:$(['0'..='9'])
        {? n.parse().or(Err("u32")).and_then(|n| Ok(ast::number(n))) }

        rule call_expr() -> Expression
            = name:idenfitier() __* "(" __* args:call_params()? __* ")"
        {
            let args = if let Some(v) = args { v } else { vec![] };
            ast::call_expr(Expression::Identifier(name.to_string()), args)
        }

        rule call_params() -> Vec<Expression>
            = expression() ++ (__* "," __*)

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
    use super::*;

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
        let expect = Ok(
            ast::binary_expr(
                Operator::Add,
                ast::number(1),
                ast::binary_expr(
                    Operator::Div,
                    ast::binary_expr(
                        Operator::Mult,
                        ast::number(2),
                        ast::binary_expr(
                            Operator::Add,
                            ast::number(3),
                            ast::number(4)
                        ),
                    ),
                    ast::number(5),
                ),
            )
        );
        assert_eq!(actual, expect);
    }

    #[test]
    fn test_declare_func_no_annotations() {
        let expect = Ok(ast::function_declaration(
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
        let expect = Ok(ast::function_declaration(
            "abc".to_string(),
            Some(vec![]),
            vec![
                ast::parameter("x".to_string(), Some("number".to_string())),
                ast::parameter("y".to_string(), Some("number".to_string())),
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
        if let Ok(Expression::Identifier(name)) = uguisu_parser::expression("a") {
            assert_eq!(name, "a");
        } else {
            panic!("incorrect result 1");
        }

        if let Ok(Expression::Identifier(name)) = uguisu_parser::expression("z") {
            assert_eq!(name, "z");
        } else {
            panic!("incorrect result 2");
        }

        if let Ok(Expression::Identifier(name)) = uguisu_parser::expression("_") {
            assert_eq!(name, "_");
        } else {
            panic!("incorrect result 3");
        }

        if let Ok(_) = uguisu_parser::expression("$") {
            panic!("incorrect result 4");
        }
    }

    #[test]
    fn test_identifier_multi_ascii() {
        if let Ok(Expression::Identifier(name)) = uguisu_parser::expression("abc") {
            assert_eq!(name, "abc");
        } else {
            panic!("incorrect result");
        }

        if let Ok(_) = uguisu_parser::expression("0ab") {
            panic!("incorrect result");
        }
    }

    #[test]
    fn test_identifier_multi_byte() {
        if let Ok(Expression::Identifier(name)) = uguisu_parser::expression("あ") {
            assert_eq!(name, "あ");
        } else {
            panic!("incorrect result");
        }

        if let Ok(Expression::Identifier(name)) = uguisu_parser::expression("変数1") {
            assert_eq!(name, "変数1");
        } else {
            panic!("incorrect result");
        }
    }
}

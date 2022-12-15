use super::ast::*;

peg::parser! {
  grammar uguisu_parser() for str {
    pub rule root() -> Vec<Statement>
      = sp()* s:statement() ** (sp()*) sp()* { s }

    pub rule statement() -> Statement
      = declaration_func()
      / return_statement()
      // / declaration_var()

    pub rule expr() -> Expression = precedence! {
      // left:(@) sp()* "==" sp()* right:@ { Expression::eq(left, right) }
      // left:(@) sp()* "!=" sp()* right:@ { Expression::ne(left, right) }
      // --
      // left:(@) sp()* "<" sp()* right:@ { Expression::lt(left, right) }
      // left:(@) sp()* "<=" sp()* right:@ { Expression::lte(left, right) }
      // left:(@) sp()* ">" sp()* right:@ { Expression::gt(left, right) }
      // left:(@) sp()* ">=" sp()* right:@ { Expression::gte(left, right) }
      // --
      left:(@) sp()* "+" sp()* right:@ { Expression::add(left, right) }
      left:(@) sp()* "-" sp()* right:@ { Expression::sub(left, right) }
      --
      // left:(@) sp()* "*" sp()* right:@ { Expression::mult(left, right) }
      // left:(@) sp()* "/" sp()* right:@ { Expression::div(left, right) }
      // left:(@) sp()* "%" sp()* right:@ { Expression::mod(left, right) }
      // --
      // "!" sp()* right:(@) { right }
      // "+" sp()* right:(@) { right }
      // "-" sp()* right:(@) { Expression::mult(Expression::number(-1), right) }
      // --
      n:number() { n }
      //id:idenfitier() { Expression::idenfitier(id) }
      "(" sp()* e:expr() sp()* ")" { e }
    }

    // rule declaration_var() -> Node
    //   = kind:("let" {DeclarationAttr::Let} / "const" {DeclarationAttr::Const}) sp()+ id:idenfitier() sp()* "=" sp()* def:expr() ";"
    // { Node::declaration(id, vec![kind], def) }

    rule declaration_func() -> Statement
      = "fn" sp()+ id:idenfitier() sp()* "(" sp()* ")" sp()* "{" sp()* body:statement() ** (sp()*) sp()* "}"
    { Statement::func_declaration(id, Some(body)/*, vec![]*/) }

    rule return_statement() -> Statement
      = "return" e2:(sp()+ e1:expr() { e1 })? sp()* ";"
    {
      if let Some(v) = e2 {
        Statement::return_statement_with_value(v)
      } else {
        Statement::return_statement()
      }
    }

    rule number() -> Expression
      = n:$(['1'..='9'] ['0'..='9']+) {? n.parse().or(Err("u32")).and_then(|n| Ok(Expression::number(n))) }
      / n:$(['0'..='9']) {? n.parse().or(Err("u32")).and_then(|n| Ok(Expression::number(n))) }

    rule idenfitier() -> &'input str
      = !['0'..='9'] s:$(identifier_char()+) { s }

    rule identifier_char() -> char
      = &['\u{00}'..='\u{7F}'] c:['A'..='Z'|'a'..='z'|'0'..='9'|'_'] { c }
      / !['\u{00}'..='\u{7F}'] c:[_] { c }

    rule sp() -> char
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
    Err(e) => Err(ParserError::new(format!("expects {}. ({})", e.expected, e.location).as_str())),
  }
}

#[cfg(test)]
mod test {
  use crate::engine::ast::Statement;
  use crate::engine::ast::Expression;
  use super::uguisu_parser;

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

  // #[test]
  // fn test_calc() {
  //   let actual = uguisu_parser::expr("1+2*(3+4)/5");
  //   let expect = Ok(Expression::add(
  //     Expression::number(1),
  //     Expression::div(
  //       Expression::mult(
  //         Expression::number(2),
  //         Expression::add(
  //           Expression::number(3),
  //           Expression::number(4),
  //         ),
  //       ),
  //       Expression::number(5),
  //     ),
  //   ));
  //   assert_eq!(actual, expect);
  // }

  // #[test]
  // fn test_identifier_single_ascii() {
  //   if let Ok(Expression::Identifier(name)) = uguisu_parser::expr("a") {
  //     assert_eq!(name, "a");
  //   } else {
  //     panic!("incorrect result 1");
  //   }

  //   if let Ok(Expression::Identifier(name)) = uguisu_parser::expr("z") {
  //     assert_eq!(name, "z");
  //   } else {
  //     panic!("incorrect result 2");
  //   }

  //   if let Ok(Expression::Identifier(name)) = uguisu_parser::expr("_") {
  //     assert_eq!(name, "_");
  //   } else {
  //     panic!("incorrect result 3");
  //   }

  //   if let Ok(_) = uguisu_parser::expr("$") {
  //     panic!("incorrect result 4");
  //   }
  // }

  // #[test]
  // fn test_identifier_multi_ascii() {
  //   if let Ok(Node::Identifier(name)) = uguisu_parser::expr("abc") {
  //     assert_eq!(name, "abc");
  //   } else {
  //     panic!("incorrect result");
  //   }

  //   if let Ok(_) = uguisu_parser::expr("0ab") {
  //     panic!("incorrect result");
  //   }
  // }

  // #[test]
  // fn test_identifier_multi_byte() {
  //   if let Ok(Node::Identifier(name)) = uguisu_parser::expr("あ") {
  //     assert_eq!(name, "あ");
  //   } else {
  //     panic!("incorrect result");
  //   }

  //   if let Ok(Node::Identifier(name)) = uguisu_parser::expr("変数1") {
  //     assert_eq!(name, "変数1");
  //   } else {
  //     panic!("incorrect result");
  //   }
  // }
}

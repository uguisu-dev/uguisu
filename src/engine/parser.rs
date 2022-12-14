use super::ast::*;

peg::parser! {
  grammar uguisu_parser() for str {
    pub rule root() -> Vec<Node>
      = sp()* s:statement() ** (sp()*) sp()* { s }

    pub rule statement() -> Node
      = declaration_var()
      / declaration_func()
      / return_statement()

    pub rule expr() -> Node = precedence! {
      // left:(@) sp()* "==" sp()* right:@ { Node::eq(left, right) }
      // left:(@) sp()* "!=" sp()* right:@ { Node::ne(left, right) }
      // --
      // left:(@) sp()* "<" sp()* right:@ { Node::lt(left, right) }
      // left:(@) sp()* "<=" sp()* right:@ { Node::lte(left, right) }
      // left:(@) sp()* ">" sp()* right:@ { Node::gt(left, right) }
      // left:(@) sp()* ">=" sp()* right:@ { Node::gte(left, right) }
      // --
      left:(@) sp()* "+" sp()* right:@ { Node::add(left, right) }
      left:(@) sp()* "-" sp()* right:@ { Node::sub(left, right) }
      --
      left:(@) sp()* "*" sp()* right:@ { Node::mult(left, right) }
      left:(@) sp()* "/" sp()* right:@ { Node::div(left, right) }
      //left:(@) sp()* "%" sp()* right:@ { Node::mod(left, right) }
      --
      // "!" sp()* right:(@) { right }
      "+" sp()* right:(@) { right }
      "-" sp()* right:(@) { Node::mult(Node::number(-1), right) }
      --
      n:number() { n }
      id:idenfitier() { id }
      "(" sp()* e:expr() sp()* ")" { e }
    }

    rule declaration_var() -> Node
      = kind:("let" {DeclarationAttr::Let} / "const" {DeclarationAttr::Const}) sp()+ id:idenfitier() sp()* "=" sp()* def:expr() ";"
    { Node::declaration(id, vec![kind], def) }

    rule declaration_func() -> Node
      = "fn" sp()+ id:idenfitier() sp()* "(" sp()* ")" sp()* "{" sp()* children:statement() ** (sp()*) sp()* "}"
    { Node::declaration(id, vec![], Node::function(children)) }

    rule return_statement() -> Node
      = "return" sp()* e2:(e1:expr() sp()* { e1 })? ";" { Node::return_func(e2) }

    rule number() -> Node
      = n:$(['1'..='9'] ['0'..='9']+) {? n.parse().or(Err("u32")).and_then(|n| Ok(Node::number(n))) }
      / n:$(['0'..='9']) {? n.parse().or(Err("u32")).and_then(|n| Ok(Node::number(n))) }

    rule idenfitier() -> Node
      = !['0'..='9'] s:$(identifier_char()+) { Node::identifier(s) }

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

pub fn parse(input: &str) -> Result<Vec<Node>, ParserError> {
  match uguisu_parser::root(input) {
    Ok(n) => Ok(n),
    Err(e) => Err(ParserError::new(format!("expects {}. ({})", e.expected, e.location).as_str())),
  }
}

#[cfg(test)]
mod test {
  use crate::engine::ast::Node;
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

  #[test]
  fn test_calc() {
    let actual = uguisu_parser::expr("1+2*(3+4)/5");
    let expect = Ok(Node::add(
      Node::number(1),
      Node::div(
        Node::mult(
          Node::number(2),
          Node::add(
            Node::number(3),
            Node::number(4),
          ),
        ),
        Node::number(5),
      ),
    ));
    assert_eq!(actual, expect);
  }

  #[test]
  fn test_identifier_single_ascii() {
    if let Ok(Node::Identifier(name)) = uguisu_parser::expr("a") {
      assert_eq!(name, "a");
    } else {
      panic!("incorrect result 1");
    }

    if let Ok(Node::Identifier(name)) = uguisu_parser::expr("z") {
      assert_eq!(name, "z");
    } else {
      panic!("incorrect result 2");
    }

    if let Ok(Node::Identifier(name)) = uguisu_parser::expr("_") {
      assert_eq!(name, "_");
    } else {
      panic!("incorrect result 3");
    }

    if let Ok(_) = uguisu_parser::expr("$") {
      panic!("incorrect result 4");
    }
  }

  #[test]
  fn test_identifier_multi_ascii() {
    if let Ok(Node::Identifier(name)) = uguisu_parser::expr("abc") {
      assert_eq!(name, "abc");
    } else {
      panic!("incorrect result");
    }

    if let Ok(_) = uguisu_parser::expr("0ab") {
      panic!("incorrect result");
    }
  }

  #[test]
  fn test_identifier_multi_byte() {
    if let Ok(Node::Identifier(name)) = uguisu_parser::expr("あ") {
      assert_eq!(name, "あ");
    } else {
      panic!("incorrect result");
    }

    if let Ok(Node::Identifier(name)) = uguisu_parser::expr("変数1") {
      assert_eq!(name, "変数1");
    } else {
      panic!("incorrect result");
    }
  }
}

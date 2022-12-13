use self::node::*;

pub mod node;

peg::parser! {
  grammar uguisu_parser() for str {
    pub rule let_statement() -> Node
      = "let" sp()+ n:idenfitier() sp()* "=" sp()* e:expr() { Node::declaration_with_definition(n, vec![DeclarationAttr::Let], e) }

    pub rule expr() -> Node = precedence!{
      left:(@) sp()* "+" sp()* right:@ { Node::add(left, right) }
      left:(@) sp()* "-" sp()* right:@ { Node::sub(left, right) }
      --
      left:(@) sp()* "*" sp()* right:@ { Node::mult(left, right) }
      left:(@) sp()* "/" sp()* right:@ { Node::div(left, right) }
      --
      n:number() { n }
      id:idenfitier() { id }
      "(" sp()* e:expr() sp()* ")" { e }
    }

    rule number() -> Node
      = n:$(['1'..='9'] ['0'..='9']+) {? n.parse().or(Err("u32")).and_then(|n| Ok(Node::number(n))) }
      / n:$(['0'..='9']) {? n.parse().or(Err("u32")).and_then(|n| Ok(Node::number(n))) }

    rule idenfitier() -> Node
      = s:$(!['0'..='9'] identifier_char() identifier_char()*) { Node::identifier(s) }

    rule identifier_char() -> char
      = &['\u{00}'..='\u{7F}'] c:['A'..='Z'|'a'..='z'|'0'..='9'|'_'] { c }
      / !['\u{00}'..='\u{7F}'] c:[_] { c }

    rule sp() -> char
      = c:[' '|'\t'] { c }
  }
}

#[derive(Debug, Clone)]
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

pub fn parse(input: &str) -> Result<Node, ParserError> {
  match uguisu_parser::expr(input) {
    Ok(n) => Ok(n),
    Err(_) => Err(ParserError::new("parse failed")),
  } 
}

#[cfg(test)]
mod test {
  use crate::parser::{uguisu_parser, Node};

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

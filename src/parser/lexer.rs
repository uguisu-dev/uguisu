use super::node::Node;

pub struct Lexer {

}

impl Lexer {
  pub fn new(input: &str) -> Self {
    Lexer {
    }
  }

  pub fn next(&mut self) {

  }

  fn next_string_literal(&mut self) {
    
  }

  fn next_number(&mut self) {
    let node = Node::number(1);
  }
}

mod node;

use self::node::Node;

enum Token {

}

struct ParserContext {
  tokens: Vec<Token>,
  pos: u32,
}

fn parse(input: &str) {

}

fn parse_statement(tokens: &Vec<Token>, pos: u32) -> Result<(Node, u32), &str> {
  panic!("not implement");
}

fn parse_expression() {
  panic!("not implement");
}

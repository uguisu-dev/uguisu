pub struct NumberNode {
  value: u32,
}

pub struct FloatNode {
  value: f64,
}

pub enum Node {
  Number(NumberNode),
  Float(FloatNode),
}

impl Node {
  pub fn number(value: u32) -> Node {
    Node::Number(NumberNode { value })
  }
}

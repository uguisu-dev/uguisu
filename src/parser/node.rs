#[derive(Debug, PartialEq)]
pub enum Node {
  Number(u32),
  BinaryOp(BinaryOpNode),
  Identifier(String),
  Declaration(DeclarationNode),
  //Bool(bool),
  //Func(FuncNode),
  //Call(CallNode),
}

impl Node {
  pub fn number(value: u32) -> Node {
    Node::Number(value)
  }

  pub fn add(left: Node, right: Node) -> Node {
    Node::BinaryOp(BinaryOpNode {
      op: OpKind::Add,
      left: Box::new(left),
      right: Box::new(right),
    })
  }

  pub fn sub(left: Node, right: Node) -> Node {
    Node::BinaryOp(BinaryOpNode {
      op: OpKind::Sub,
      left: Box::new(left),
      right: Box::new(right),
    })
  }

  pub fn mult(left: Node, right: Node) -> Node {
    Node::BinaryOp(BinaryOpNode {
      op: OpKind::Mult,
      left: Box::new(left),
      right: Box::new(right),
    })
  }

  pub fn div(left: Node, right: Node) -> Node {
    Node::BinaryOp(BinaryOpNode {
      op: OpKind::Div,
      left: Box::new(left),
      right: Box::new(right),
    })
  }

  pub fn identifier(name: &str) -> Node {
    Node::Identifier(name.to_string())
  }

  pub fn declaration_with_definition(identifier: Node, attributes: Vec<DeclarationAttr>, definition: Node) -> Node {
    Node::Declaration(DeclarationNode {
      identifier: Box::new(identifier),
      attributes,
      definition: Some(Box::new(definition)),
    })
  }

  // pub fn call(target_name: String, args: Vec<Node>) -> Node {
  //   Node::Call(CallNode { target_name, args })
  // }

  // pub fn func(children: Vec<Node>) -> Node {
  //   Node::Func(FuncNode { children })
  // }
}

#[derive(Debug, PartialEq)]
pub struct BinaryOpNode {
  op: OpKind,
  left: Box<Node>,
  right: Box<Node>,
}

#[derive(Debug, PartialEq)]
pub enum OpKind {
  Add,
  Sub,
  Mult,
  Div,
}

#[derive(Debug, PartialEq)]
pub struct DeclarationNode {
  identifier: Box<Node>,
  attributes: Vec<DeclarationAttr>,
  definition: Option<Box<Node>>,
}

#[derive(Debug, PartialEq)]
pub enum DeclarationAttr {
  Const,
  Let,
  //Export,
  //External,
}

// #[derive(Debug, PartialEq)]
// pub struct CallNode {
//   target_name: String,
//   args: Vec<Node>,
// }

// #[derive(Debug, PartialEq)]
// pub struct FuncNode {
//   // TODO: param types
//   // TODO: return type
//   children: Vec<Node>,
// }

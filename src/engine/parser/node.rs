#[derive(Debug, PartialEq)]
pub enum Node {
  Number(i32),
  BinaryOp(BinaryOpNode),
  Identifier(String),
  Declaration(DeclarationNode),
  Function(FunctionNode),
  Return(Option<Box<Node>>),
  //Bool(bool),
  //Call(CallNode),
}

impl Node {
  pub fn number(value: i32) -> Node {
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

  pub fn declaration(identifier: Node, attributes: Vec<DeclarationAttr>, expr: Node) -> Node {
    Node::Declaration(DeclarationNode {
      identifier: Box::new(identifier),
      attributes,
      definition: Some(Box::new(expr)),
    })
  }

  pub fn function(children: Vec<Node>) -> Node {
    Node::Function(FunctionNode { children })
  }

  pub fn return_func(value: Option<Node>) -> Node {
    Node::Return(
      if let Some(v) = value {
        Some(Box::new(v))
      } else {
        None
      }
    )
  }

  // pub fn call(target_name: String, args: Vec<Node>) -> Node {
  //   Node::Call(CallNode { target_name, args })
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

#[derive(Debug, PartialEq)]
pub struct FunctionNode {
  // TODO: param types
  // TODO: return type
  children: Vec<Node>,
}

// #[derive(Debug, PartialEq)]
// pub struct CallNode {
//   target_name: String,
//   args: Vec<Node>,
// }

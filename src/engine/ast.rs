#[derive(Debug, PartialEq)]
pub enum Statement {
  FuncDeclaration(FuncDeclaration),
  Return(Option<Box<Expression>>),
  //VarDeclaration(VarDeclaration),
}

impl Statement {
  pub fn func_declaration(identifier: &str, body: Option<Vec<Statement>>, /*attributes: Vec<FuncAttribute>,*/) -> Statement {
    Statement::FuncDeclaration(FuncDeclaration {
      identifier: identifier.to_string(),
      body,
      //attributes,
    })
  }

  pub fn return_statement() -> Statement {
    Statement::Return(None)
  }

  pub fn return_statement_with_value(expr: Expression) -> Statement {
    Statement::Return(Some(Box::new(expr)))
  }
}

#[derive(Debug, PartialEq)]
pub enum Expression {
  Number(i32),
  BinaryOp(BinaryOp),
  //Identifier(String),
  //Bool(bool),
  //Call(CallNode),
}

impl Expression {
  pub fn number(value: i32) -> Expression {
    Expression::Number(value)
  }

  pub fn add(left: Expression, right: Expression) -> Expression {
    Expression::BinaryOp(BinaryOp {
      kind: BinaryOpKind::Add,
      left: Box::new(left),
      right: Box::new(right),
    })
  }

  pub fn sub(left: Expression, right: Expression) -> Expression {
    Expression::BinaryOp(BinaryOp {
      kind: BinaryOpKind::Sub,
      left: Box::new(left),
      right: Box::new(right),
    })
  }

  // pub fn mult(left: Expression, right: Expression) -> Expression {
  //   Expression::BinaryOp(BinaryOp {
  //     kind: BinaryOpKind::Mult,
  //     left: Box::new(left),
  //     right: Box::new(right),
  //   })
  // }

  // pub fn div(left: Expression, right: Expression) -> Expression {
  //   Expression::BinaryOp(BinaryOp {
  //     kind: BinaryOpKind::Div,
  //     left: Box::new(left),
  //     right: Box::new(right),
  //   })
  // }

  // pub fn identifier(name: &str) -> Expression {
  //   Expression::Identifier(name.to_string())
  // }

  // pub fn call(target_name: String, args: Vec<Expression>) -> Expression {
  //   Expression::Call(CallNode { target_name, args })
  // }

  // pub fn function(children: Vec<Statement>) -> Expression {
  //   Expression::Function(FunctionNode { children })
  // }
}

#[derive(Debug, PartialEq)]
pub struct BinaryOp {
  pub kind: BinaryOpKind,
  pub left: Box<Expression>,
  pub right: Box<Expression>,
}

#[derive(Debug, PartialEq)]
pub enum BinaryOpKind {
  Add,
  Sub,
  //Mult,
  //Div,
}

// #[derive(Debug, PartialEq)]
// pub struct VarDeclaration {
//   pub identifier: String,
//   pub attributes: Vec<VarAttribute>,
//   pub definition: Option<Box<Expression>>,
// }

// #[derive(Debug, PartialEq)]
// pub enum VarAttribute {
//   Const,
//   Let,
// }

#[derive(Debug, PartialEq)]
pub struct FuncDeclaration {
  pub identifier: String,
  //attributes: Vec<FuncAttribute>,
  // TODO: param types
  // TODO: return type
  pub body: Option<Vec<Statement>>,
}

#[derive(Debug, PartialEq)]
pub enum FuncAttribute {
  //External,
  //Export,
}

// #[derive(Debug, PartialEq)]
// pub struct CallNode {
//   target_name: String,
//   args: Vec<Node>,
// }

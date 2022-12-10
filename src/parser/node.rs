use super::Token;

#[derive(Debug)]
pub enum Node {
  Number(NumberNode),
  Call(CallNode),
  Func(FuncNode),
  VarDeclaration(VarDeclarationNode),
  FuncDeclaration(FuncDeclarationNode),
  BinaryExpr(BinaryExprNode),
}

// Number

#[derive(Debug)]
pub struct NumberNode {
  value_int: u32,
}

pub fn number_node(value: u32) -> Node {
  Node::Number(NumberNode { value_int: value })
}

// Call

#[derive(Debug)]
pub struct CallNode {
  target_name: String,
  args: Vec<Node>,
}

pub fn call_node(target_name: String, args: Vec<Node>) -> Node {
  Node::Call(CallNode { target_name, args })
}

// Func

#[derive(Debug)]
pub struct FuncNode {
  // TODO: param types
  // TODO: return type
  children: Vec<Node>,
}

pub fn func_node(children: Vec<Node>) -> Node {
  Node::Func(FuncNode { children })
}

// VarDeclaration

#[derive(Debug)]
pub struct VarDeclarationNode {
  name: String,
  attributes: Vec<VarDeclarationAttr>,
  definition: Option<Box<Node>>,
}

#[derive(Debug)]
pub enum VarDeclarationAttr {
  Const,
  Let,
}

pub fn var_declaration_node(name: String, attributes: Vec<VarDeclarationAttr>, definition: Option<Box<Node>>) -> Node {
  Node::VarDeclaration(VarDeclarationNode { name, attributes, definition })
}

// FuncDeclaration

#[derive(Debug)]
pub struct FuncDeclarationNode {
  name: String,
  // TODO: param types
  // TODO: return type
  attributes: Vec<FuncDeclarationAttr>,
  definition: Option<Vec<Node>>,
}

#[derive(Debug)]
pub enum FuncDeclarationAttr {
  Export,
  External,
}

pub fn declare_func_node(name: String, attributes: Vec<FuncDeclarationAttr>, definition: Option<Vec<Node>>) -> Node {
  Node::FuncDeclaration(FuncDeclarationNode { name, attributes, definition })
}

// Op

#[derive(Debug)]
pub struct BinaryExprNode {
  op: OpKind,
  left: Box<Node>,
  right: Box<Node>,
}

#[derive(Debug)]
pub enum OpKind {
  Add,
  Sub,
  Mult,
  Div,
}

pub fn binary_expr_node(op: OpKind, left: Box<Node>, right: Box<Node>) -> Node {
  Node::BinaryExpr(BinaryExprNode { op, left, right })
}

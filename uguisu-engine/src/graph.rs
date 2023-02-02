use std::collections::HashMap;
use crate::ast;
use crate::types::Type;

pub(crate) type NodeId = usize;

#[derive(Clone, Copy)]
pub struct NodeRef {
    pub id: NodeId,
}

impl NodeRef {
    pub(crate) fn new(node_id: NodeId) -> Self {
        Self { id: node_id }
    }

    pub(crate) fn get<'a>(&self, source: &'a HashMap<NodeId, Node>) -> &'a Node {
        &source[&self.id]
    }

    pub(crate) fn get_mut<'a>(&self, source: &'a mut HashMap<NodeId, Node>) -> &'a mut Node {
        match source.get_mut(&self.id) {
            Some(x) => x,
            None => panic!(),
        }
    }
}

pub(crate) enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    BreakStatement(BreakStatement),
    ReturnStatement(ReturnStatement),
    Assignment(Assignment),
    IfStatement(IfStatement),
    LoopStatement(LoopStatement),
    // expression
    Reference(Reference),
    Literal(Literal),
    RelationalOp(RelationalOp),
    LogicalBinaryOp(LogicalBinaryOp),
    ArithmeticOp(ArithmeticOp),
    LogicalUnaryOp(LogicalUnaryOp),
    CallExpr(CallExpr),
    FuncParam(FuncParam),
}

impl Node {
    pub(crate) fn get_ty(&self) -> Result<Type, String> {
        match self {
            Node::Reference(node) => Ok(node.ty),
            Node::Literal(node) => Ok(node.ty),
            Node::RelationalOp(node) => Ok(node.ty),
            Node::LogicalBinaryOp(node) => Ok(node.ty),
            Node::ArithmeticOp(node) => Ok(node.ty),
            Node::LogicalUnaryOp(node) => Ok(node.ty),
            Node::CallExpr(node) => Ok(node.ty),
            Node::FuncParam(node) => Ok(node.ty),
            Node::VariableDeclaration(node) => Ok(node.ty),
            Node::FunctionDeclaration(_) => Ok(Type::Function),
            Node::BreakStatement(_)
            | Node::ReturnStatement(_)
            | Node::Assignment(_)
            | Node::IfStatement(_)
            | Node::LoopStatement(_) => {
                panic!("unexpected node");
            }
        }
    }

    pub(crate) fn get_pos(&self) -> (usize, usize) {
        match self {
            Self::FunctionDeclaration(node) => node.pos,
            Self::VariableDeclaration(node) => node.pos,
            Self::BreakStatement(node) => node.pos,
            Self::ReturnStatement(node) => node.pos,
            Self::Assignment(node) => node.pos,
            Self::IfStatement(node) => node.pos,
            Self::LoopStatement(node) => node.pos,
            Self::Reference(node) => node.pos,
            Self::Literal(node) => node.pos,
            Self::RelationalOp(node) => node.pos,
            Self::LogicalBinaryOp(node) => node.pos,
            Self::ArithmeticOp(node) => node.pos,
            Self::LogicalUnaryOp(node) => node.pos,
            Self::CallExpr(node) => node.pos,
            Self::FuncParam(node) => node.pos,
        }
    }

    pub(crate) fn as_function_decl(&self) -> Result<&FunctionDeclaration, String> {
        match self {
            Node::FunctionDeclaration(x) => Ok(x),
            _ => Err("function declaration expected".to_owned()),
        }
    }

    pub(crate) fn as_function_decl_mut(&mut self) -> Result<&mut FunctionDeclaration, String> {
        match self {
            Node::FunctionDeclaration(x) => Ok(x),
            _ => Err("function declaration expected".to_owned()),
        }
    }

    pub(crate) fn as_reference(&self) -> Result<&Reference, String> {
        match self {
            Node::Reference(x) => Ok(x),
            _ => Err("reference expected".to_owned()),
        }
    }

    pub(crate) fn as_func_param(&self) -> Result<&FuncParam, String> {
        match self {
            Node::FuncParam(x) => Ok(x),
            _ => Err("function parameter expected".to_owned()),
        }
    }
}

pub(crate) enum FunctionBody {
    Statements(Vec<NodeRef>),
    NativeCode,
}

pub(crate) struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<FunctionBody>,
    pub params: Vec<NodeRef>,
    pub ret_ty: Type,
    pub pos: (usize, usize),
}

pub(crate) struct FuncParam {
    pub identifier: String,
    // pub param_index: usize,
    pub ty: Type,
    pub pos: (usize, usize),
}

pub(crate) struct VariableDeclaration {
    pub identifier: String,
    pub body: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

pub(crate) struct BreakStatement {
    pub pos: (usize, usize),
}

pub(crate) struct ReturnStatement {
    pub body: Option<NodeRef>,
    pub pos: (usize, usize),
}

pub(crate) struct Assignment {
    pub dest: NodeRef,
    pub body: NodeRef,
    pub mode: ast::AssignmentMode,
    pub pos: (usize, usize),
}

pub(crate) struct IfStatement {
    pub condition: NodeRef,
    pub then_block: Vec<NodeRef>,
    pub else_block: Vec<NodeRef>,
    pub pos: (usize, usize),
}

pub(crate) struct LoopStatement {
    pub body: Vec<NodeRef>,
    pub pos: (usize, usize),
}

pub(crate) struct Reference {
    pub dest: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

pub(crate) struct Literal {
    pub value: LiteralValue,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub(crate) enum LiteralValue {
    Number(i64),
    Bool(bool),
}

pub(crate) struct RelationalOp {
    pub operator: RelationalOperator,
    pub relation_type: Type,
    pub left: NodeRef,
    pub right: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub(crate) enum RelationalOperator {
    Equal,
    NotEqual,
    GreaterThan,
    GreaterThanEqual,
    LessThan,
    LessThanEqual,
}

pub(crate) struct LogicalBinaryOp {
    pub operator: LogicalBinaryOperator,
    pub left: NodeRef,
    pub right: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub(crate) enum LogicalBinaryOperator {
    And,
    Or,
}

pub(crate) struct LogicalUnaryOp {
    pub operator: LogicalUnaryOperator,
    pub expr: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub(crate) enum LogicalUnaryOperator {
    Not,
}

pub(crate) struct ArithmeticOp {
    pub operator: ArithmeticOperator,
    pub left: NodeRef,
    pub right: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub(crate) enum ArithmeticOperator {
    Add,
    Sub,
    Mult,
    Div,
    Mod,
}

pub(crate) struct CallExpr {
    pub callee: NodeRef,
    pub args: Vec<NodeRef>,
    pub ty: Type,
    pub pos: (usize, usize),
}

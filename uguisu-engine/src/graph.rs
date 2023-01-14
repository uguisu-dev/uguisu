use std::collections::HashMap;

pub type NodeId = usize;

#[derive(Debug, PartialEq)]
pub enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    ReturnStatement(Option<Box<Node>>),
    Assignment(Assignment),
    // expression
    Literal(Literal),
    BinaryExpr(BinaryExpr),
    CallExpr(CallExpr),
    FuncParam(FuncParam),
}

#[derive(Debug, PartialEq)]
pub struct FunctionDeclaration {
    pub id: NodeId,
    pub identifier: String,
    pub body: Option<Vec<NodeId>>,
    //pub params: Vec<NodeId>,
    //pub ret: Option<Type>,
    pub is_external: bool,
}

#[derive(Debug, PartialEq)]
pub struct FuncParam {
    pub id: NodeId,
    pub identifier: String,
    //pub type_identifier: Option<String>,
}

#[derive(Debug, PartialEq)]
pub struct VariableDeclaration {
    pub id: NodeId,
    pub identifier: String,
    pub body: NodeId,
    pub is_mutable: bool,
    //pub ty: Type,
    //pub is_func_param: bool,
    //pub func_param_index: usize,
}

#[derive(Debug, PartialEq)]
pub struct Assignment {
    pub id: NodeId,
    pub dest: NodeId,
    pub body: NodeId,
}

#[derive(Debug, PartialEq)]
pub struct Literal {
    pub id: NodeId,
    pub value: LiteralValue,
}

#[derive(Debug, PartialEq)]
pub enum LiteralValue {
    Number(i32),
}

#[derive(Debug, PartialEq)]
pub struct BinaryExpr {
    pub id: NodeId,
    pub operator: Operator,
    pub left: NodeId,
    pub right: NodeId,
}

#[derive(Debug, PartialEq)]
pub enum Operator {
    Add,
    Sub,
    Mult,
    Div,
}

#[derive(Debug, PartialEq)]
pub struct CallExpr {
    pub id: NodeId,
    pub callee: NodeId,
    pub args: Vec<NodeId>,
}

// #[derive(Debug, PartialEq, Clone)]
// pub enum Type {
//     Number,
// }

#[derive(Debug, PartialEq, Clone)]
pub struct ScopeLayer {
    nodes: Vec<NodeId>,
}

impl ScopeLayer {
    pub fn new() -> Self {
        Self {
            nodes: Vec::new(),
        }
    }
}

#[derive(Debug, PartialEq, Clone)]
pub struct Scope {
    layers: Vec<ScopeLayer>,
}

impl Scope {
    pub fn new() -> Self {
        Self {
            layers: vec![ScopeLayer::new()],
        }
    }

    pub fn enter_scope(&mut self) {
        self.layers.insert(0, ScopeLayer::new());
    }

    pub fn leave_scope(&mut self) {
        if self.layers.len() == 1 {
            panic!("Left the root scope.");
        }
        self.layers.remove(0);
    }

    pub fn add_node(&mut self, node: NodeId) {
        match self.layers.get_mut(0) {
            Some(layer) => {
                layer.nodes.push(node);
            }
            None => panic!("layer not found"),
        }
    }
}

pub struct Resolver<'a> {
    nodes: &'a mut HashMap<NodeId, Node>,
    scope: &'a mut Scope,
}

impl<'a> Resolver<'a> {
    pub fn new(nodes: &'a mut HashMap<NodeId, Node>, scope: &'a mut Scope) -> Self {
        Self { nodes, scope }
    }
}

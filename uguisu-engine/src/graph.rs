use std::collections::HashMap;
use crate::{parse, CompileError};

pub type NodeId = usize;

// NOTE: consider parent node

#[derive(Debug, PartialEq)]
pub enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    ReturnStatement(Option<NodeId>),
    Assignment(Assignment),
    // expression
    Literal(Literal),
    BinaryExpr(BinaryExpr),
    CallExpr(CallExpr),
    FuncParamDeclaration(FuncParamDeclaration),
}

#[derive(Debug, PartialEq)]
pub struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<Vec<NodeId>>,
    pub params: Vec<NodeId>,
    //pub ret_ty: Option<Type>,
    pub is_external: bool,
}

#[derive(Debug, PartialEq)]
pub struct FuncParamDeclaration {
    pub identifier: String,
    //pub ty: Type,
}

#[derive(Debug, PartialEq)]
pub struct VariableDeclaration {
    pub identifier: String,
    pub body: NodeId,
    pub is_mutable: bool,
    //pub ty: Type,
    //pub is_func_param: bool,
    //pub func_param_index: usize,
}

#[derive(Debug, PartialEq)]
pub struct Assignment {
    pub dest: NodeId,
    pub body: NodeId,
}

#[derive(Debug, PartialEq)]
pub struct Literal {
    pub value: LiteralValue,
}

#[derive(Debug, PartialEq)]
pub enum LiteralValue {
    Number(i32),
}

#[derive(Debug, PartialEq)]
pub struct BinaryExpr {
    pub operator: parse::Operator,
    pub left: NodeId,
    pub right: NodeId,
}

#[derive(Debug, PartialEq)]
pub struct CallExpr {
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

pub struct GraphTranslator<'a> {
    nodes: &'a mut HashMap<NodeId, Node>,
    scope: Scope,
}

impl<'a> GraphTranslator<'a> {
    pub fn new(nodes: &'a mut HashMap<NodeId, Node>) -> Self {
        Self {
            nodes,
            scope: Scope::new(),
        }
    }

    pub fn translate(&mut self, ast: &Vec<parse::Node>) -> Result<Vec<NodeId>, CompileError> {
        let mut ids = Vec::new();
        for parser_node in ast.iter() {
            ids.push(self.translate_node(parser_node)?);
        }
        Ok(ids)
    }

    fn resolve_identifier(&self, identifier: &str) -> Option<NodeId> {
        for layer in self.scope.layers.iter() {
            for node_id in layer.nodes.iter() {
                match &self.nodes[node_id] {
                    Node::FunctionDeclaration(func) => {
                        if func.identifier == identifier {
                            return Some(*node_id);
                        }
                    }
                    Node::VariableDeclaration(variable) => {
                        if variable.identifier == identifier {
                            return Some(*node_id);
                        }
                    }
                    Node::FuncParamDeclaration(param) => {
                        if param.identifier == identifier {
                            return Some(*node_id);
                        }
                    }
                    _ => {}
                }
            }
        }
        None
    }

    fn translate_node(&mut self, parser_node: &parse::Node) -> Result<NodeId, CompileError> {
        match parser_node {
            parse::Node::FunctionDeclaration(decl) => {
                // when local scope
                if self.scope.layers.len() >= 2 {
                    return Err(CompileError::new("local function is not supported"));
                }
                let mut params = Vec::new();
                for param in decl.params.iter() {
                    // make param node
                    let node = Node::FuncParamDeclaration(FuncParamDeclaration {
                        identifier: param.identifier.clone(),
                    });
                    let node_id = self.nodes.len();
                    self.nodes.insert(node_id, node);
                    params.push(node_id);
                }
                let body = match &decl.body {
                    Some(body_nodes) => Some(self.translate(body_nodes)?),
                    None => None,
                };
                let is_external = decl.attributes.iter().any(|x| *x == parse::FunctionAttribute::External);
                // make function node
                let node = Node::FunctionDeclaration(FunctionDeclaration {
                    identifier: decl.identifier.clone(),
                    params,
                    body,
                    is_external,
                });
                let node_id = self.nodes.len();
                self.nodes.insert(node_id, node);
                // add to scope
                self.scope.add_node(node_id);
                Ok(node_id)
            }
            parse::Node::VariableDeclaration(decl) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(CompileError::new("global variable is not supported"));
                }
                let body = self.translate_node(&decl.body)?;
                let is_mutable = decl.attributes.iter().any(|x| *x == parse::VariableAttribute::Let);
                // make node
                let node = Node::VariableDeclaration(VariableDeclaration {
                    identifier: decl.identifier.clone(),
                    body,
                    is_mutable,
                });
                let node_id = self.nodes.len();
                self.nodes.insert(node_id, node);
                // add to scope
                self.scope.add_node(node_id);
                Ok(node_id)
            }
            parse::Node::ReturnStatement(expr) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(CompileError::new("return is not supported in global"));
                }
                let inner = match expr {
                    Some(x) => Some(self.translate_node(x)?),
                    None => None,
                };
                let node = Node::ReturnStatement(inner);
                let node_id = self.nodes.len();
                self.nodes.insert(node_id, node);
                Ok(node_id)
            }
            parse::Node::Assignment(statement) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(CompileError::new("assignment is not supported in global"));
                }
                let dest = self.translate_node(&statement.dest)?;
                let body = self.translate_node(&statement.body)?;
                let node = Node::Assignment(Assignment {
                    dest,
                    body,
                });
                let node_id = self.nodes.len();
                self.nodes.insert(node_id, node);
                Ok(node_id)
            }
            parse::Node::NodeRef(node_ref) => {
                match self.resolve_identifier(&node_ref.identifier) {
                    Some(node_id) => Ok(node_id),
                    None => Err(CompileError::new("unknown identifier")),
                }
            }
            parse::Node::Literal(parse::Literal::Number(n)) => {
                let node = Node::Literal(Literal {
                    value: LiteralValue::Number(*n),
                });
                let node_id = self.nodes.len();
                self.nodes.insert(node_id, node);
                Ok(node_id)
            }
            parse::Node::BinaryExpr(binary_expr) => {
                let left = self.translate_node(&binary_expr.left)?;
                let right = self.translate_node(&binary_expr.right)?;
                // TODO: check type compatibility
                let node = Node::BinaryExpr(BinaryExpr {
                    operator: binary_expr.operator.clone(),
                    left,
                    right,
                });
                let node_id = self.nodes.len();
                self.nodes.insert(node_id, node);
                Ok(node_id)
            }
            parse::Node::CallExpr(call_expr) => {
                let callee = self.translate_node(&call_expr.callee)?;
                let args = self.translate(&call_expr.args)?;
                let node = Node::CallExpr(CallExpr {
                    callee,
                    args,
                });
                let node_id = self.nodes.len();
                self.nodes.insert(node_id, node);
                Ok(node_id)
            }
            _ => panic!(),
        }
    }
}

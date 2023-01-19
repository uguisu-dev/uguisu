use crate::{parse, SyntaxError};
use std::collections::HashMap;

pub type NodeId = usize;

// NOTE: consider type check
// NOTE: consider parent node

#[derive(Debug)]
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

#[derive(Debug)]
pub struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<Vec<NodeId>>,
    pub params: Vec<NodeId>,
    //pub ret_ty: Option<Type>,
    pub is_external: bool,
}

#[derive(Debug)]
pub struct FuncParamDeclaration {
    pub identifier: String,
    pub param_index: usize,
    //pub ty: Type,
}

#[derive(Debug)]
pub struct VariableDeclaration {
    pub identifier: String,
    pub body: NodeId,
    pub is_mutable: bool,
    //pub ty: Type,
    //pub is_func_param: bool,
    //pub func_param_index: usize,
}

#[derive(Debug)]
pub struct Assignment {
    pub dest: NodeId,
    pub body: NodeId,
}

#[derive(Debug)]
pub struct Literal {
    pub value: LiteralValue,
}

#[derive(Debug)]
pub enum LiteralValue {
    Number(i32),
}

#[derive(Debug)]
pub struct BinaryExpr {
    pub operator: parse::Operator,
    pub left: NodeId,
    pub right: NodeId,
}

#[derive(Debug)]
pub struct CallExpr {
    pub callee: NodeId,
    pub args: Vec<NodeId>,
}

// #[derive(Debug, PartialEq, Clone)]
// pub enum Type {
//     Number,
// }

#[derive(Debug, Clone)]
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

#[derive(Debug, Clone)]
struct ScopeLayer {
    nodes: Vec<NodeId>,
}

impl ScopeLayer {
    pub fn new() -> Self {
        Self { nodes: Vec::new() }
    }
}

// ノードグラフの生成や各種チェック処理など
pub struct Analyzer<'a> {
    source: &'a mut HashMap<NodeId, Node>,
    scope: Scope,
}

impl<'a> Analyzer<'a> {
    pub fn new(source: &'a mut HashMap<NodeId, Node>) -> Self {
        Self {
            source,
            scope: Scope::new(),
        }
    }

    fn create_node(&mut self, node: Node) -> NodeId {
        let node_id = self.source.len();
        self.source.insert(node_id, node);
        node_id
    }

    fn lookup_node(&self, node_id: NodeId) -> &Node {
        &self.source[&node_id]
    }

    fn lookup_identifier(&self, identifier: &str) -> Option<NodeId> {
        for layer in self.scope.layers.iter() {
            for &node_id in layer.nodes.iter() {
                match self.lookup_node(node_id) {
                    Node::FunctionDeclaration(func) => {
                        if func.identifier == identifier {
                            return Some(node_id);
                        }
                    }
                    Node::VariableDeclaration(variable) => {
                        if variable.identifier == identifier {
                            return Some(node_id);
                        }
                    }
                    Node::FuncParamDeclaration(param) => {
                        if param.identifier == identifier {
                            return Some(node_id);
                        }
                    }
                    _ => {}
                }
            }
        }
        None
    }

    pub fn translate(&mut self, ast: &Vec<parse::Node>) -> Result<Vec<NodeId>, SyntaxError> {
        let mut ids = Vec::new();
        for parser_node in ast.iter() {
            ids.push(self.translate_node(parser_node)?);
        }
        Ok(ids)
    }

    fn translate_node(&mut self, parser_node: &parse::Node) -> Result<NodeId, SyntaxError> {
        match parser_node {
            parse::Node::FunctionDeclaration(decl) => {
                // when local scope
                if self.scope.layers.len() >= 2 {
                    return Err(SyntaxError::new("local function is not supported"));
                }
                self.scope.enter_scope();
                let mut params = Vec::new();
                for (i, param) in decl.params.iter().enumerate() {
                    // make param node
                    let node = Node::FuncParamDeclaration(FuncParamDeclaration {
                        identifier: param.identifier.clone(),
                        param_index: i,
                    });
                    let node_id = self.create_node(node);
                    // add to scope
                    self.scope.add_node(node_id);
                    params.push(node_id);
                }
                let body = match &decl.body {
                    Some(body_nodes) => Some(self.translate(body_nodes)?),
                    None => None,
                };
                self.scope.leave_scope();
                let is_external = decl
                    .attributes
                    .iter()
                    .any(|x| *x == parse::FunctionAttribute::External);
                // make function node
                let node = Node::FunctionDeclaration(FunctionDeclaration {
                    identifier: decl.identifier.clone(),
                    params,
                    body,
                    is_external,
                });
                let node_id = self.create_node(node);
                // add to scope
                self.scope.add_node(node_id);
                Ok(node_id)
            }
            parse::Node::VariableDeclaration(decl) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new("global variable is not supported"));
                }
                let body = self.translate_node(&decl.body)?;
                let is_mutable = decl
                    .attributes
                    .iter()
                    .any(|x| *x == parse::VariableAttribute::Let);
                // make node
                let node = Node::VariableDeclaration(VariableDeclaration {
                    identifier: decl.identifier.clone(),
                    body,
                    is_mutable,
                });
                let node_id = self.create_node(node);
                // add to scope
                self.scope.add_node(node_id);
                Ok(node_id)
            }
            parse::Node::ReturnStatement(expr) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new("return is not supported in global"));
                }
                let inner = match expr {
                    Some(x) => Some(self.translate_node(x)?),
                    None => None,
                };
                let node = Node::ReturnStatement(inner);
                let node_id = self.create_node(node);
                Ok(node_id)
            }
            parse::Node::Assignment(statement) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new("assignment is not supported in global"));
                }
                let dest = self.translate_node(&statement.dest)?;
                let body = self.translate_node(&statement.body)?;
                let node = Node::Assignment(Assignment { dest, body });
                let node_id = self.create_node(node);
                Ok(node_id)
            }
            parse::Node::NodeRef(node_ref) => {
                match self.lookup_identifier(&node_ref.identifier) {
                    Some(node_id) => Ok(node_id),
                    None => Err(SyntaxError::new("unknown identifier")),
                }
            }
            parse::Node::Literal(parse::Literal::Number(n)) => {
                let node = Node::Literal(Literal {
                    value: LiteralValue::Number(*n),
                });
                let node_id = self.create_node(node);
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
                let node_id = self.create_node(node);
                Ok(node_id)
            }
            parse::Node::CallExpr(call_expr) => {
                let callee = self.translate_node(&call_expr.callee)?;
                let args = self.translate(&call_expr.args)?;
                let node = Node::CallExpr(CallExpr { callee, args });
                let node_id = self.create_node(node);
                Ok(node_id)
            }
        }
    }

    pub fn show_graph(&self) {
        for i in 0..self.source.len() {
            self.show_node(i);
        }
    }

    fn show_node(&self, node_id: NodeId) {
        let name = match self.lookup_node(node_id) {
            Node::FunctionDeclaration(_) => "FunctionDeclaration",
            Node::VariableDeclaration(_) => "VariableDeclaration",
            Node::ReturnStatement(_) => "ReturnStatement",
            Node::Assignment(_) => "Assignment",
            Node::Literal(_) => "Literal",
            Node::BinaryExpr(_) => "BinaryExpr",
            Node::CallExpr(_) => "CallExpr",
            Node::FuncParamDeclaration(_) => "FuncParamDeclaration",
        };
        println!("[{}] {}", node_id, name);

        match self.lookup_node(node_id) {
            Node::FunctionDeclaration(func) => {
                println!("  params: {{");
                for param in func.params.iter() {
                    println!("    [{}]", param);
                }
                println!("  }}");
                match &func.body {
                    Some(body) => {
                        println!("  body: {{");
                        for item in body.iter() {
                            println!("    [{}]", item);
                        }
                        println!("  }}");
                    }
                    None => {
                        println!("  body: (None)");
                    }
                }
                println!("  is_external: {}", func.is_external);
            }
            Node::VariableDeclaration(variable) => {
                println!("  body: {{");
                println!("    [{}]", variable.body);
                println!("  }}");
                println!("  is_mutable: {}", variable.is_mutable);
            }
            Node::ReturnStatement(expr) => {
                match expr {
                    Some(x) => {
                        println!("  expr: {{");
                        println!("    [{}]", x);
                        println!("  }}");
                    }
                    None => {
                        println!("  expr: (None)");
                    }
                }
            }
            Node::Assignment(statement) => {
                println!("  dest: {{");
                println!("    [{}]", statement.dest);
                println!("  }}");
                println!("  body: {{");
                println!("    [{}]", statement.body);
                println!("  }}");
            }
            Node::Literal(literal) => {
                println!("  value: {:?}", literal.value);
            }
            Node::BinaryExpr(binary_expr) => {
                println!("  operator: {:?}", binary_expr.operator);
                println!("  left: {{");
                println!("    [{}]", binary_expr.left);
                println!("  }}");
                println!("  right: {{");
                println!("    [{}]", binary_expr.right);
                println!("  }}");
            }
            Node::CallExpr(call_expr) => {
                println!("  callee: {{");
                println!("    [{}]", call_expr.callee);
                println!("  }}");
                println!("  args: {{");
                for arg in call_expr.args.iter() {
                    println!("    [{}]", arg);
                }
                println!("  }}");
            }
            Node::FuncParamDeclaration(_) => {}
        }
    }
}

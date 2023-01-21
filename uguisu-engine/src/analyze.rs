use crate::{parse, SyntaxError};
use std::collections::HashMap;

pub type NodeId = usize;

#[derive(Debug, Clone, Copy)]
pub struct NodeRef {
    pub id: NodeId,
}

impl NodeRef {
    pub fn new(node_id: NodeId) -> Self {
        Self { id: node_id }
    }

    pub fn as_node<'a>(&self, source: &'a HashMap<NodeId, Node>) -> &'a Node {
        &source[&self.id]
    }
}

// NOTE: consider type check
// NOTE: consider parent node

#[derive(Debug)]
pub enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    ReturnStatement(Option<NodeRef>),
    Assignment(Assignment),
    // expression
    Literal(Literal),
    BinaryExpr(BinaryExpr),
    CallExpr(CallExpr),
    FuncParam(FuncParam),
}

#[derive(Debug, PartialEq, Clone)]
pub enum Type {
    Number,
}

#[derive(Debug)]
pub struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<Vec<NodeRef>>,
    pub params: Vec<NodeRef>,
    pub ret_ty: Option<Type>,
    pub is_external: bool,
}

#[derive(Debug)]
pub struct FuncParam {
    pub identifier: String,
    pub param_index: usize,
    pub ty: Type,
}

#[derive(Debug)]
pub struct VariableDeclaration {
    pub identifier: String,
    pub body: NodeRef,
    pub is_mutable: bool,
    pub ty: Type,
}

#[derive(Debug)]
pub struct Assignment {
    pub dest: NodeRef,
    pub body: NodeRef,
}

#[derive(Debug)]
pub struct Literal {
    pub value: LiteralValue,
    pub ty: Type,
}

#[derive(Debug)]
pub enum LiteralValue {
    Number(i32),
}

#[derive(Debug)]
pub struct BinaryExpr {
    pub operator: parse::Operator,
    pub left: NodeRef,
    pub right: NodeRef,
    pub ty: Type,
}

#[derive(Debug)]
pub struct CallExpr {
    pub callee: NodeRef,
    pub args: Vec<NodeRef>,
    pub ty: Option<Type>,
}

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

    pub fn add_node(&mut self, identifier: &str, node: NodeRef) {
        match self.layers.get_mut(0) {
            Some(layer) => {
                layer.nodes.insert(identifier.to_string(), node);
            }
            None => panic!("layer not found"),
        }
    }

    fn lookup(&self, identifier: &str) -> Option<NodeRef> {
        for layer in self.layers.iter() {
            match layer.nodes.get(identifier) {
                Some(&x) => return Some(x),
                None => {}
            }
        }
        None
    }
}

#[derive(Debug, Clone)]
struct ScopeLayer {
    nodes: HashMap<String, NodeRef>,
}

impl ScopeLayer {
    pub fn new() -> Self {
        Self { nodes: HashMap::new() }
    }
}

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

    fn create_node(&mut self, node: Node) -> NodeRef {
        let node_id = self.source.len();
        self.source.insert(node_id, node);
        NodeRef::new(node_id)
    }

    fn lookup_ty(ty_identifier: &str) -> Result<Type, SyntaxError> {
        match ty_identifier {
            "number" => Ok(Type::Number),
            _ => Err(SyntaxError::new("unknown type")),
        }
    }

    fn get_ty(&self, node_ref: NodeRef) -> Option<Type> {
        match node_ref.as_node(self.source) {
            Node::Literal(literal) => {
                Some(literal.ty.clone())
            }
            Node::BinaryExpr(binary_expr) => {
                Some(binary_expr.ty.clone())
            }
            Node::CallExpr(call_expr) => {
                call_expr.ty.clone()
            }
            Node::FuncParam(func_param) => {
                Some(func_param.ty.clone())
            }
            Node::VariableDeclaration(variable) => {
                Some(variable.ty.clone())
            }
            _ => panic!("unexpected node (node_id={}, node={:?})", node_ref.id, node_ref.as_node(self.source)),
        }
    }

    fn compare_ty_option(x: Option<Type>, y: Option<Type>) -> Result<Option<Type>, SyntaxError> {
        if x == y {
            Ok(x)
        } else {
            Err(SyntaxError::new("type error"))
        }
    }

    /// Generate a resolved graph from a AST.
    pub fn translate(&mut self, ast: &Vec<parse::Node>) -> Result<Vec<NodeRef>, SyntaxError> {
        let mut ids = self.translate_statements(ast)?;

        // make call main function
        let call_main = parse::call_expr(parse::reference("main"), Vec::new());
        ids.push(self.translate_expr(&call_main)?);

        Ok(ids)
    }

    fn translate_statements(&mut self, parser_nodes: &Vec<parse::Node>) -> Result<Vec<NodeRef>, SyntaxError> {
        let mut ids = Vec::new();
        for parser_node in parser_nodes.iter() {
            ids.push(self.translate_statement(parser_node)?);
        }
        Ok(ids)
    }

    /// Generate a graph node from a statement AST node.
    /// - check if the statement is available in the global or local
    /// - check type compatibility for inner expression
    fn translate_statement(&mut self, parser_node: &parse::Node) -> Result<NodeRef, SyntaxError> {
        match parser_node {
            parse::Node::FunctionDeclaration(decl) => {
                self.scope.enter_scope();
                let mut params = Vec::new();
                for (i, param) in decl.params.iter().enumerate() {
                    // make param node
                    let node = Node::FuncParam(FuncParam {
                        identifier: param.identifier.clone(),
                        param_index: i,
                        ty: Type::Number,
                    });
                    let node_ref = self.create_node(node);
                    // add to scope
                    self.scope.add_node(&param.identifier, node_ref);
                    params.push(node_ref);
                }
                let body = match &decl.body {
                    Some(body_nodes) => Some(self.translate_statements(body_nodes)?),
                    None => None,
                };
                self.scope.leave_scope();
                let is_external = decl
                    .attributes
                    .iter()
                    .any(|x| *x == parse::FunctionAttribute::External);
                let ret_ty = match &decl.ret {
                    Some(x) => Some(Self::lookup_ty(x)?),
                    None => None,
                };
                // make function node
                let node = Node::FunctionDeclaration(FunctionDeclaration {
                    identifier: decl.identifier.clone(),
                    params,
                    body,
                    ret_ty,
                    is_external,
                });
                let node_ref = self.create_node(node);
                // add to scope
                self.scope.add_node(&decl.identifier, node_ref);
                Ok(node_ref)
            }
            parse::Node::VariableDeclaration(decl) => {
                let body = self.translate_expr(&decl.body)?;
                let is_mutable = decl
                    .attributes
                    .iter()
                    .any(|x| *x == parse::VariableAttribute::Let);
                let ty = match self.get_ty(body) {
                    Some(x) => x,
                    None => return Err(SyntaxError::new("value expected")),
                };
                // make node
                let node = Node::VariableDeclaration(VariableDeclaration {
                    identifier: decl.identifier.clone(),
                    body,
                    is_mutable,
                    ty,
                });
                let node_ref = self.create_node(node);
                // add to scope
                self.scope.add_node(&decl.identifier, node_ref);
                Ok(node_ref)
            }
            parse::Node::ReturnStatement(expr) => {
                // TODO: consider type check
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new("A return statement cannot be used in global space"));
                }
                let inner = match expr {
                    Some(x) => Some(self.translate_expr(x)?),
                    None => None,
                };
                let node = Node::ReturnStatement(inner);
                let node_ref = self.create_node(node);
                Ok(node_ref)
            }
            parse::Node::Assignment(statement) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new("An assignment statement cannot be used in global space"));
                }
                let dest = self.translate_expr(&statement.dest)?;
                let body = self.translate_expr(&statement.body)?;
                let node = Node::Assignment(Assignment { dest, body });
                let node_ref = self.create_node(node);
                Ok(node_ref)
            }
            parse::Node::Reference(_)
            | parse::Node::Literal(_)
            | parse::Node::BinaryExpr(_)
            | parse::Node::CallExpr(_) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new("An expression cannot be used in global space"));
                }
                self.translate_expr(parser_node)
            }
        }
    }

    /// Generate a graph node from a expression AST node.
    /// - check type compatibility for inner expression
    fn translate_expr(&mut self, parser_node: &parse::Node) -> Result<NodeRef, SyntaxError> {
        match parser_node {
            parse::Node::Reference(reference) => {
                match self.scope.lookup(&reference.identifier) {
                    Some(node_ref) => Ok(node_ref),
                    None => Err(SyntaxError::new("unknown identifier")),
                }
            }
            parse::Node::Literal(parse::Literal::Number(n)) => {
                let node = Node::Literal(Literal {
                    value: LiteralValue::Number(*n),
                    ty: Type::Number,
                });
                let node_ref = self.create_node(node);
                Ok(node_ref)
            }
            parse::Node::BinaryExpr(binary_expr) => {
                let left = self.translate_expr(&binary_expr.left)?;
                let right = self.translate_expr(&binary_expr.right)?;
                let left_ty = self.get_ty(left);
                let right_ty = self.get_ty(right);
                let ty = Self::compare_ty_option(left_ty, right_ty)?;
                if ty != Some(Type::Number) {
                    return Err(SyntaxError::new("type error: number expected"));
                }
                let node = Node::BinaryExpr(BinaryExpr {
                    operator: binary_expr.operator.clone(),
                    left,
                    right,
                    ty: Type::Number,
                });
                let node_ref = self.create_node(node);
                Ok(node_ref)
            }
            parse::Node::CallExpr(call_expr) => {
                let callee_node = self.translate_expr(&call_expr.callee)?;
                let callee = match callee_node.as_node(self.source) {
                    Node::FunctionDeclaration(decl) => decl,
                    _ => return Err(SyntaxError::new("function expected")),
                };
                let ret_ty = callee.ret_ty.clone();
                let params = callee.params.clone();
                if params.len() != call_expr.args.len() {
                    return Err(SyntaxError::new("argument count incorrect"));
                }
                let mut args = Vec::new();
                for (i, &param) in params.iter().enumerate() {
                    let arg = self.translate_expr(&call_expr.args[i])?;
                    let param_ty = self.get_ty(param);
                    let arg_ty = self.get_ty(arg);
                    Self::compare_ty_option(param_ty, arg_ty)?;
                    args.push(arg);
                }
                let node = Node::CallExpr(CallExpr { callee: callee_node, args, ty: ret_ty, });
                let node_ref = self.create_node(node);
                Ok(node_ref)
            }
            _ => panic!("unexpected expr node"),
        }
    }

    /// Show the resolved graph
    pub fn show_graph(&self) {
        for i in 0..self.source.len() {
            self.show_node(NodeRef::new(i));
        }
    }

    fn show_node(&self, node_ref: NodeRef) {
        let name = match node_ref.as_node(self.source) {
            Node::FunctionDeclaration(_) => "FunctionDeclaration",
            Node::VariableDeclaration(_) => "VariableDeclaration",
            Node::ReturnStatement(_) => "ReturnStatement",
            Node::Assignment(_) => "Assignment",
            Node::Literal(_) => "Literal",
            Node::BinaryExpr(_) => "BinaryExpr",
            Node::CallExpr(_) => "CallExpr",
            Node::FuncParam(_) => "FuncParam",
        };
        println!("[{}] {}", node_ref.id, name);

        match node_ref.as_node(self.source) {
            Node::FunctionDeclaration(func) => {
                println!("  name: {}", func.identifier);
                println!("  params: {{");
                for param in func.params.iter() {
                    println!("    [{}]", param.id);
                }
                println!("  }}");
                match &func.body {
                    Some(body) => {
                        println!("  body: {{");
                        for item in body.iter() {
                            println!("    [{}]", item.id);
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
                println!("  name: {}", variable.identifier);
                println!("  body: {{");
                println!("    [{}]", variable.body.id);
                println!("  }}");
                println!("  is_mutable: {}", variable.is_mutable);
            }
            Node::ReturnStatement(expr) => {
                match expr {
                    Some(x) => {
                        println!("  expr: {{");
                        println!("    [{}]", x.id);
                        println!("  }}");
                    }
                    None => {
                        println!("  expr: (None)");
                    }
                }
            }
            Node::Assignment(statement) => {
                println!("  dest: {{");
                println!("    [{}]", statement.dest.id);
                println!("  }}");
                println!("  body: {{");
                println!("    [{}]", statement.body.id);
                println!("  }}");
            }
            Node::Literal(literal) => {
                println!("  value: {:?}", literal.value);
            }
            Node::BinaryExpr(binary_expr) => {
                println!("  operator: {:?}", binary_expr.operator);
                println!("  left: {{");
                println!("    [{}]", binary_expr.left.id);
                println!("  }}");
                println!("  right: {{");
                println!("    [{}]", binary_expr.right.id);
                println!("  }}");
            }
            Node::CallExpr(call_expr) => {
                println!("  callee: {{");
                println!("    [{}]", call_expr.callee.id);
                println!("  }}");
                println!("  args: {{");
                for arg in call_expr.args.iter() {
                    println!("    [{}]", arg.id);
                }
                println!("  }}");
            }
            Node::FuncParam(func_param) => {
                println!("  name: {}", func_param.identifier);
            }
        }
    }
}

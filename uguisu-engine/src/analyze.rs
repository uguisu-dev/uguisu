use crate::parse;
use std::collections::HashMap;

#[cfg(test)]
mod test;

#[derive(Debug, Clone)]
pub struct SyntaxError {
    pub message: String,
}

impl SyntaxError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

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

#[derive(Debug)]
pub enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    ReturnStatement(Option<NodeRef>),
    Assignment(Assignment),
    IfStatement(IfStatement),
    LoopStatement(Vec<NodeRef>),
    // expression
    Literal(Literal),
    BinaryExpr(BinaryExpr),
    CallExpr(CallExpr),
    FuncParam(FuncParam),
}

#[derive(Debug, PartialEq, Clone)]
pub enum Type {
    Number,
    Bool,
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
pub struct IfStatement {
    pub condition: NodeRef,
    pub then_block: Vec<NodeRef>,
    pub else_block: Vec<NodeRef>,
}

#[derive(Debug)]
pub struct Literal {
    pub value: LiteralValue,
    pub ty: Type,
}

#[derive(Debug)]
pub enum LiteralValue {
    Number(i64),
    Bool(bool),
}

#[derive(Debug)]
pub struct BinaryExpr {
    pub operator: Operator,
    pub left: NodeRef,
    pub right: NodeRef,
    pub ty: Type,
}

#[derive(Debug, PartialEq, Clone)]
pub enum Operator {
    Add,
    Sub,
    Mult,
    Div,
    Equal,
    NotEqual,
    GreaterThan,
    GreaterThanEqual,
    LessThan,
    LessThanEqual,
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

    fn get_node(&self, node_ref: NodeRef) -> Option<&Node> {
        self.source.get(&node_ref.id)
    }

    fn get_node_mut(&mut self, node_ref: NodeRef) -> Option<&mut Node> {
        self.source.get_mut(&node_ref.id)
    }

    fn lookup_ty(ty_identifier: &str) -> Result<Type, SyntaxError> {
        match ty_identifier {
            "number" => Ok(Type::Number),
            "bool" => Ok(Type::Bool),
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

    fn compare_ty(&self, x: Type, y: Type) -> Result<Type, SyntaxError> {
        if x == y {
            Ok(x)
        } else {
            Err(SyntaxError::new("type error"))
        }
    }

    fn compare_ty_option(&self, x: Option<Type>, y: Option<Type>) -> Result<Option<Type>, SyntaxError> {
        if x == y {
            Ok(x)
        } else {
            Err(SyntaxError::new("type error"))
        }
    }

    fn register_builtin(&mut self, name: &str, params: Vec<(&str, Type)>, ret_ty: Option<Type>) -> NodeRef {
        let mut param_nodes = Vec::new();
        for (i, (param_name, param_ty)) in params.iter().enumerate() {
            // make param node
            let node = Node::FuncParam(FuncParam {
                identifier: String::from(*param_name),
                param_index: i,
                ty: param_ty.clone(),
            });
            let node_ref = self.create_node(node);
            param_nodes.push(node_ref);
        }
        // make function node
        let decl_node = Node::FunctionDeclaration(FunctionDeclaration {
            identifier: String::from(name),
            params: param_nodes,
            ret_ty,
            is_external: true,
            body: None,
        });
        let node_ref = self.create_node(decl_node);
        // add to scope
        self.scope.add_node(name, node_ref);
        node_ref
    }

    /// Generate a resolved graph from a AST.
    pub fn translate(&mut self, ast: &Vec<parse::Node>) -> Result<Vec<NodeRef>, SyntaxError> {
        let mut ids = Vec::new();

        // register builtin declarations
        ids.push(self.register_builtin(
            "print_num",
            vec![("value", Type::Number)],
            None,
        ));
        ids.push(self.register_builtin(
            "assert_eq",
            vec![("actual", Type::Number), ("expected", Type::Number)],
            None,
        ));

        ids.extend(self.translate_statements(ast)?);

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
            parse::Node::FunctionDeclaration(parser_decl) => {
                let mut params = Vec::new();
                for (i, param) in parser_decl.params.iter().enumerate() {
                    let param_type = match &param.type_identifier {
                        Some(x) => Self::lookup_ty(x)?,
                        None => return Err(SyntaxError::new("parameter type missing")),
                    };
                    // make param node
                    let node = Node::FuncParam(FuncParam {
                        identifier: param.identifier.clone(),
                        param_index: i,
                        ty: param_type,
                    });
                    let node_ref = self.create_node(node);
                    params.push(node_ref);
                }
                let ret_ty = match &parser_decl.ret {
                    Some(x) => Some(Self::lookup_ty(x)?),
                    None => None,
                };
                let is_external = parser_decl
                    .attributes
                    .iter()
                    .any(|x| *x == parse::FunctionAttribute::External);
                if is_external {
                    return Err(SyntaxError::new("External function declarations are obsoleted"));
                }
                // make function node
                let decl_node = Node::FunctionDeclaration(FunctionDeclaration {
                    identifier: parser_decl.identifier.clone(),
                    params,
                    ret_ty,
                    is_external,
                    body: None,
                });
                let node_ref = self.create_node(decl_node);
                // add to scope
                self.scope.add_node(&parser_decl.identifier, node_ref);

                // define body
                self.scope.enter_scope();
                let mut i = 0;
                loop {
                    let decl = match self.get_node(node_ref) {
                        Some(Node::FunctionDeclaration(x)) => x,
                        _ => panic!("failed get_node"),
                    };
                    let param = match decl.params.get(i) {
                        Some(&x) => x,
                        None => break,
                    };
                    let param_node = match param.as_node(self.source) {
                        Node::FuncParam(x) => x,
                        _ => panic!("unexpected"),
                    };
                    // add to scope
                    self.scope.add_node(&param_node.identifier, param);
                    i += 1;
                }
                let body = match &parser_decl.body {
                    Some(body_nodes) => Some(self.translate_statements(body_nodes)?),
                    None => None,
                };
                let decl = match self.get_node_mut(node_ref) {
                    Some(Node::FunctionDeclaration(x)) => x,
                    _ => panic!("failed get_node"),
                };
                decl.body = body;
                self.scope.leave_scope();

                Ok(node_ref)
            }
            parse::Node::VariableDeclaration(decl) => {
                let body = self.translate_expr(&decl.body)?;
                let is_mutable = decl
                    .attributes
                    .iter()
                    .any(|x| *x == parse::VariableAttribute::Let);
                let infer_ty = match self.get_ty(body) {
                    Some(x) => x,
                    None => return Err(SyntaxError::new("value expected")),
                };
                let ty = match &decl.type_identifier {
                    Some(ident) => {
                        let ty = Self::lookup_ty(ident)?;
                        self.compare_ty(ty, infer_ty)?
                    }
                    None => infer_ty,
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
            parse::Node::IfStatement(if_statement) => {
                fn transform(
                    index: usize,
                    analyzer: &mut Analyzer,
                    items: &Vec<(Box<parse::Node>,Vec<parse::Node>)>,
                    else_block: &Option<Vec<parse::Node>>,
                ) -> Result<Option<NodeRef>, SyntaxError> {
                    match items.get(index) {
                        Some((cond, then_block)) => {
                            let cond_node = analyzer.translate_expr(cond)?;
                            if analyzer.get_ty(cond_node) != Some(Type::Bool) {
                                return Err(SyntaxError::new("type error: bool expected"));
                            }
                            let then_nodes = analyzer.translate_statements(then_block)?;
                            // next else if part
                            let elif = transform(index + 1, analyzer, items, else_block)?;
                            match elif {
                                Some(x) => {
                                    let node = Node::IfStatement(IfStatement {
                                        condition: cond_node,
                                        then_block: then_nodes,
                                        else_block: vec![x],
                                    });
                                    let node_ref = analyzer.create_node(node);
                                    Ok(Some(node_ref))
                                },
                                None => {
                                    let else_nodes = match &else_block {
                                        Some(x) => analyzer.translate_statements(x)?,
                                        None => vec![],
                                    };
                                    let node = Node::IfStatement(IfStatement {
                                        condition: cond_node,
                                        then_block: then_nodes,
                                        else_block: else_nodes,
                                    });
                                    let node_ref = analyzer.create_node(node);
                                    Ok(Some(node_ref))
                                }
                            }
                        }
                        None => Ok(None),
                    }
                }
                // desugar and make node
                let node_ref = match transform(0, self, &if_statement.cond_blocks, &if_statement.else_block)? {
                    Some(x) => x,
                    None => panic!("unexpected error: cond blocks is empty"),
                };
                Ok(node_ref)
            }
            parse::Node::LoopStatement(statement) => {
                let body = self.translate_statements(&statement.body)?;
                let node = Node::LoopStatement(body);
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
    /// - infer type for the expression
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
            parse::Node::Literal(parse::Literal::Bool(value)) => {
                let node = Node::Literal(Literal {
                    value: LiteralValue::Bool(*value),
                    ty: Type::Bool,
                });
                let node_ref = self.create_node(node);
                Ok(node_ref)
            }
            parse::Node::BinaryExpr(binary_expr) => {
                let left = self.translate_expr(&binary_expr.left)?;
                let right = self.translate_expr(&binary_expr.right)?;
                let left_ty = self.get_ty(left);
                let right_ty = self.get_ty(right);
                let op = match binary_expr.operator.as_str() {
                    "+" => Operator::Add,
                    "-" => Operator::Sub,
                    "*" => Operator::Mult,
                    "/" => Operator::Div,
                    "==" => Operator::Equal,
                    "!=" => Operator::NotEqual,
                    "<" => Operator::LessThan,
                    "<=" => Operator::LessThanEqual,
                    ">" => Operator::GreaterThan,
                    ">=" => Operator::GreaterThanEqual,
                    _ => panic!("unexpected operator"),
                };
                let node = match op {
                    Operator::Add
                    | Operator::Sub
                    | Operator::Mult
                    | Operator::Div => {
                        let ty = self.compare_ty_option(left_ty, right_ty)?;
                        if ty != Some(Type::Number) {
                            return Err(SyntaxError::new("type error: number expected"));
                        }
                        Node::BinaryExpr(BinaryExpr {
                            operator: op,
                            left,
                            right,
                            ty: Type::Number,
                        })
                    }
                    Operator::Equal
                    | Operator::NotEqual
                    | Operator::LessThan
                    | Operator::LessThanEqual
                    | Operator::GreaterThan
                    | Operator::GreaterThanEqual => {
                        let ty = self.compare_ty_option(left_ty, right_ty)?;
                        Node::BinaryExpr(BinaryExpr {
                            operator: op,
                            left,
                            right,
                            ty: Type::Bool,
                        })
                    }
                };
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
                    self.compare_ty_option(param_ty, arg_ty)?;
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
            Node::IfStatement(_) => "IfStatement",
            Node::LoopStatement(_) => "LoopStatement",
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
            Node::IfStatement(if_statement) => {
                println!("  condition: {{");
                println!("    [{}]", if_statement.condition.id);
                println!("  }}");
                println!("  then_block: {{");
                for item in if_statement.then_block.iter() {
                    println!("    [{}]", item.id);
                }
                println!("  }}");
                println!("  else_block: {{");
                for item in if_statement.else_block.iter() {
                    println!("    [{}]", item.id);
                }
                println!("  }}");
            }
            Node::LoopStatement(statement) => {
                println!("  body: {{");
                for item in statement.iter() {
                    println!("    [{}]", item.id);
                }
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

use crate::{parse::{self, AssignmentMode}, SyntaxError};
use std::collections::HashMap;

#[cfg(test)]
mod test;

pub type NodeId = usize;

#[derive(Debug, Clone, Copy)]
pub struct NodeRef {
    pub id: NodeId,
}

impl NodeRef {
    pub fn new(node_id: NodeId) -> Self {
        Self { id: node_id }
    }

    pub fn get<'a>(&self, source: &'a HashMap<NodeId, Node>) -> &'a Node {
        &source[&self.id]
    }

    pub fn get_mut<'a>(&self, source: &'a mut HashMap<NodeId, Node>) -> &'a mut Node {
        match source.get_mut(&self.id) {
            Some(x) => x,
            None => panic!(),
        }
    }
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
            panic!("Left the root layer.");
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
        Self {
            nodes: HashMap::new(),
        }
    }
}

#[derive(Debug)]
pub enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    BreakStatement,
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

impl Node {
    fn get_ty(&self) -> Type {
        match self {
            Node::Literal(literal) => {
                literal.ty
            }
            Node::BinaryExpr(binary_expr) => {
                binary_expr.ty
            }
            Node::CallExpr(call_expr) => {
                call_expr.ty
            }
            Node::FuncParam(func_param) => {
                func_param.ty
            }
            Node::VariableDeclaration(variable) => {
                variable.ty
            }
            _ => panic!("unexpected node"),
        }
    }

    fn as_function(&self) -> Result<&FunctionDeclaration, SyntaxError> {
        match self {
            Node::FunctionDeclaration(decl) => Ok(decl),
            _ => return Err(SyntaxError::new("function expected")),
        }
    }
}

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum Type {
    Void,
    Number,
    Bool,
}

impl Type {
    fn get_name(&self) -> &str {
        match self {
            Type::Void => "void",
            Type::Number => "number",
            Type::Bool => "bool",
        }
    }

    fn lookup(ty_identifier: &str, input: &str, location: Option<usize>) -> Result<Type, SyntaxError> {
        match ty_identifier {
            "void" => Err(SyntaxError::new_with_location("type `void` is invalid", input, location)),
            "number" => Ok(Type::Number),
            "bool" => Ok(Type::Bool),
            _ => Err(SyntaxError::new_with_location("unknown type name", input, location)),
        }
    }

    fn assert(actual: Type, expected: Type, input: &str, location: Option<usize>) -> Result<Type, SyntaxError> {
        if actual == expected {
            Ok(actual)
        } else {
            let message = format!("type mismatched. expected `{}`, found `{}`", expected.get_name(), actual.get_name());
            Err(SyntaxError::new_with_location(message.as_str(), input, location))
        }
    }
}

#[derive(Debug)]
pub enum FunctionBody {
    Statements(Vec<NodeRef>),
    NativeCode,
}

#[derive(Debug)]
pub struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<FunctionBody>,
    pub params: Vec<NodeRef>,
    pub ret_ty: Type,
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
    pub mode: AssignmentMode,
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
    pub ty: Type,
}

pub struct Analyzer<'a> {
    input: &'a str,
    source: &'a mut HashMap<NodeId, Node>,
    scope: Scope,
}

impl<'a> Analyzer<'a> {
    pub fn new(input: &'a str, source: &'a mut HashMap<NodeId, Node>) -> Self {
        Self {
            input,
            source,
            scope: Scope::new(),
        }
    }

    /// supported newline characters: CR, CR+LF, LF
    pub fn calc_location(input: &str, index: usize) -> Result<(usize, usize), String> {
        let mut pos = 0;
        let mut line = 1;
        let mut column = 1;
        let mut cr_flag = false;
        let mut iter = input.char_indices();
        loop {
            if pos == index {
                return Ok((line, column));
            }
            // prepare next location
            let (i, c) = match iter.next() {
                Some((i, c)) => (i + c.len_utf8(), c),
                None => return Err("invalid location".to_string()),
            };
            pos = i;
            match c {
                '\r' => { // CR
                    line += 1;
                    column = 1;
                    cr_flag = true;
                }
                '\n' => { // LF
                    if cr_flag {
                        cr_flag = false;
                    } else {
                        line += 1;
                        column = 1;
                    }
                }
                _ => {
                    if cr_flag {
                        cr_flag = false;
                        column += 1;
                    } else {
                        column += 1;
                    }
                }
            }
        }
    }

    fn register_node(&mut self, node: Node) -> NodeRef {
        let node_id = self.source.len();
        self.source.insert(node_id, node);
        NodeRef::new(node_id)
    }

    fn register_builtin(
        &mut self,
        name: &str,
        params: Vec<(&str, Type)>,
        ret_ty: Type,
    ) -> NodeRef {
        let mut param_nodes = Vec::new();
        for (i, &(param_name, param_ty)) in params.iter().enumerate() {
            // make param node
            let node = Node::FuncParam(FuncParam {
                identifier: String::from(param_name),
                param_index: i,
                ty: param_ty,
            });
            let node_ref = self.register_node(node);
            param_nodes.push(node_ref);
        }
        // make function node
        let decl_node = Node::FunctionDeclaration(FunctionDeclaration {
            identifier: String::from(name),
            params: param_nodes,
            ret_ty,
            body: Some(FunctionBody::NativeCode),
        });
        let node_ref = self.register_node(decl_node);
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
            Type::Void,
        ));
        ids.push(self.register_builtin(
            "assert_eq",
            vec![("actual", Type::Number), ("expected", Type::Number)],
            Type::Void,
        ));

        ids.extend(self.translate_statements(ast)?);

        // make call main function
        let call_main = parse::call_expr(parse::reference("main").as_node_internal(), Vec::new()).as_node_internal();
        ids.push(self.translate_expr(&call_main)?);

        Ok(ids)
    }

    fn translate_statements(
        &mut self,
        parser_nodes: &Vec<parse::Node>,
    ) -> Result<Vec<NodeRef>, SyntaxError> {
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
        match &parser_node.inner {
            parse::NodeInner::FunctionDeclaration(parser_decl) => {
                let mut params = Vec::new();
                for (i, n) in parser_decl.params.iter().enumerate() {
                    let param = n.inner.as_func_param();
                    let param_type = match &param.type_identifier {
                        Some(x) => Type::lookup(x, self.input, n.location)?, // TODO: improve error location
                        None => return Err(SyntaxError::new_with_location("parameter type missing", self.input, n.location)),
                    };
                    // make param node
                    let node = Node::FuncParam(FuncParam {
                        identifier: param.identifier.clone(),
                        param_index: i,
                        ty: param_type,
                    });
                    let node_ref = self.register_node(node);
                    params.push(node_ref);
                }
                let ret_ty = match &parser_decl.ret {
                    Some(x) => Type::lookup(x, self.input, parser_node.location)?, // TODO: improve error location
                    None => Type::Void,
                };
                let is_external = parser_decl
                    .attributes
                    .iter()
                    .any(|x| *x == parse::FunctionAttribute::External);
                if is_external {
                    return Err(SyntaxError::new_with_location(
                        "External function declarations are obsoleted",
                        self.input,
                        parser_node.location,
                    ));
                }
                // make function node
                let decl_node = Node::FunctionDeclaration(FunctionDeclaration {
                    identifier: parser_decl.identifier.clone(),
                    params,
                    ret_ty,
                    body: None,
                });
                let node_ref = self.register_node(decl_node);
                // add to scope
                self.scope.add_node(&parser_decl.identifier, node_ref);

                // define body
                self.scope.enter_scope();
                let mut i = 0;
                loop {
                    let decl = match node_ref.get(self.source) {
                        Node::FunctionDeclaration(x) => x,
                        _ => panic!("function expected"),
                    };
                    let param = match decl.params.get(i) {
                        Some(&x) => x,
                        None => break,
                    };
                    let param_node = match param.get(self.source) {
                        Node::FuncParam(x) => x,
                        _ => panic!("function parameter expected"),
                    };
                    // add to scope
                    self.scope.add_node(&param_node.identifier, param);
                    i += 1;
                }
                let body = match &parser_decl.body {
                    Some(body_nodes) => Some(FunctionBody::Statements(self.translate_statements(body_nodes)?)),
                    None => None,
                };
                let decl = match node_ref.get_mut(self.source) {
                    Node::FunctionDeclaration(x) => x,
                    _ => panic!("function expected"),
                };
                decl.body = body;
                self.scope.leave_scope();

                Ok(node_ref)
            }
            parse::NodeInner::VariableDeclaration(decl) => {
                let body = self.translate_expr(&decl.body)?;
                let is_mutable = decl
                    .attributes
                    .iter()
                    .any(|x| *x == parse::VariableAttribute::Let);
                let infer_ty = body.get(self.source).get_ty();
                // NOTE: The fact that type `void` cannot be explicitly declared is used to ensure that variables of type `void` are not declared.
                let ty = match &decl.type_identifier {
                    Some(ident) => Type::assert(infer_ty, Type::lookup(ident, self.input, parser_node.location)?, self.input, parser_node.location)?, // TODO: improve error location
                    None => infer_ty,
                };
                // make node
                let node = Node::VariableDeclaration(VariableDeclaration {
                    identifier: decl.identifier.clone(),
                    body,
                    is_mutable,
                    ty,
                });
                let node_ref = self.register_node(node);
                // add to scope
                self.scope.add_node(&decl.identifier, node_ref);
                Ok(node_ref)
            }
            parse::NodeInner::BreakStatement => {
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new_with_location(
                        "A break statement cannot be used in global space",
                        self.input,
                        parser_node.location,
                    ));
                }
                // TODO: check target
                let node = Node::BreakStatement;
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::NodeInner::ReturnStatement(expr) => {
                // TODO: consider type check
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new_with_location(
                        "A return statement cannot be used in global space",
                        self.input,
                        parser_node.location,
                    ));
                }
                let inner = match expr {
                    Some(x) => Some(self.translate_expr(x)?),
                    None => None,
                };
                let node = Node::ReturnStatement(inner);
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::NodeInner::Assignment(statement) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new_with_location(
                        "An assignment statement cannot be used in global space",
                        self.input,
                        parser_node.location,
                    ));
                }
                let dest = self.translate_expr(&statement.dest)?;
                let body = self.translate_expr(&statement.body)?;
                match statement.mode {
                    AssignmentMode::Assign => {
                        let dest_ty = dest.get(self.source).get_ty();
                        let body_ty = body.get(self.source).get_ty();
                        Type::assert(body_ty, dest_ty, self.input, parser_node.location)?;
                    },
                    AssignmentMode::AddAssign
                    | AssignmentMode::SubAssign
                    | AssignmentMode::MultAssign
                    | AssignmentMode::DivAssign => {
                        let dest_ty = dest.get(self.source).get_ty();
                        Type::assert(dest_ty, Type::Number, self.input, parser_node.location)?; // TODO: improve error message
                        let body_ty = body.get(self.source).get_ty();
                        Type::assert(body_ty, Type::Number, self.input, statement.body.location)?;
                    }
                }
                let node = Node::Assignment(Assignment { dest, body, mode: statement.mode });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::NodeInner::IfStatement(if_statement) => {
                fn transform(
                    index: usize,
                    analyzer: &mut Analyzer,
                    items: &Vec<(Box<parse::Node>, Vec<parse::Node>)>,
                    else_block: &Option<Vec<parse::Node>>,
                ) -> Result<Option<NodeRef>, SyntaxError> {
                    match items.get(index) {
                        Some((cond, then_block)) => {
                            let cond_node = analyzer.translate_expr(cond)?;
                            let cond_ty = cond_node.get(analyzer.source).get_ty();
                            Type::assert(cond_ty, Type::Bool, analyzer.input, cond.location)?;
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
                                    let node_ref = analyzer.register_node(node);
                                    Ok(Some(node_ref))
                                }
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
                                    let node_ref = analyzer.register_node(node);
                                    Ok(Some(node_ref))
                                }
                            }
                        }
                        None => Ok(None),
                    }
                }
                // desugar and make node
                let node_ref = match transform(
                    0,
                    self,
                    &if_statement.cond_blocks,
                    &if_statement.else_block,
                )? {
                    Some(x) => x,
                    None => panic!("unexpected error: cond blocks is empty"),
                };
                Ok(node_ref)
            }
            parse::NodeInner::LoopStatement(statement) => {
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new_with_location(
                        "A loop statement cannot be used in global space",
                        self.input,
                        parser_node.location,
                    ));
                }
                let body = self.translate_statements(&statement.body)?;
                let node = Node::LoopStatement(body);
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::NodeInner::Reference(_)
            | parse::NodeInner::Literal(_)
            | parse::NodeInner::BinaryExpr(_)
            | parse::NodeInner::CallExpr(_) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(SyntaxError::new_with_location(
                        "An expression cannot be used in global space",
                        self.input,
                        parser_node.location,
                    ));
                }
                self.translate_expr(parser_node)
            }
            parse::NodeInner::FuncParam(_) => panic!("unexpected node"),
        }
    }

    /// Generate a graph node from a expression AST node.
    /// - infer type for the expression
    /// - check type compatibility for inner expression
    fn translate_expr(&mut self, parser_node: &parse::Node) -> Result<NodeRef, SyntaxError> {
        match &parser_node.inner {
            parse::NodeInner::Reference(reference) => {
                match self.scope.lookup(&reference.identifier) {
                    Some(node_ref) => Ok(node_ref),
                    None => Err(SyntaxError::new_with_location("unknown identifier", self.input, parser_node.location)),
                }
            }
            parse::NodeInner::Literal(parse::Literal::Number(n)) => {
                let node = Node::Literal(Literal {
                    value: LiteralValue::Number(*n),
                    ty: Type::Number,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::NodeInner::Literal(parse::Literal::Bool(value)) => {
                let node = Node::Literal(Literal {
                    value: LiteralValue::Bool(*value),
                    ty: Type::Bool,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::NodeInner::BinaryExpr(binary_expr) => {
                let left = self.translate_expr(&binary_expr.left)?;
                let right = self.translate_expr(&binary_expr.right)?;
                let left_ty = left.get(self.source).get_ty();
                let right_ty = right.get(self.source).get_ty();
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
                        Type::assert(left_ty, Type::Number, self.input, binary_expr.left.location)?;
                        Type::assert(right_ty, Type::Number, self.input, binary_expr.right.location)?;
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
                        Type::assert(right_ty, left_ty, self.input, parser_node.location)?; // TODO: improve error message
                        Node::BinaryExpr(BinaryExpr {
                            operator: op,
                            left,
                            right,
                            ty: Type::Bool,
                        })
                    }
                };
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::NodeInner::CallExpr(call_expr) => {
                let callee_node = self.translate_expr(&call_expr.callee)?;
                let callee = callee_node.get(self.source).as_function()?;
                let ret_ty = callee.ret_ty;
                let params = callee.params.clone();
                if params.len() != call_expr.args.len() {
                    return Err(SyntaxError::new_with_location("argument count incorrect", self.input, parser_node.location));
                }
                let mut args = Vec::new();
                for (i, &param) in params.iter().enumerate() {
                    let arg = self.translate_expr(&call_expr.args[i])?;
                    let param_ty = param.get(self.source).get_ty();
                    let arg_ty = arg.get(self.source).get_ty();
                    Type::assert(arg_ty, param_ty, self.input, call_expr.args[i].location)?;
                    args.push(arg);
                }
                let node = Node::CallExpr(CallExpr {
                    callee: callee_node,
                    args,
                    ty: ret_ty,
                });
                let node_ref = self.register_node(node);
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
        let name = match node_ref.get(self.source) {
            Node::FunctionDeclaration(_) => "FunctionDeclaration",
            Node::VariableDeclaration(_) => "VariableDeclaration",
            Node::BreakStatement => "BreakStatement",
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

        match node_ref.get(self.source) {
            Node::FunctionDeclaration(func) => {
                println!("  name: {}", func.identifier);
                println!("  params: {{");
                for param in func.params.iter() {
                    println!("    [{}]", param.id);
                }
                println!("  }}");
                match &func.body {
                    Some(FunctionBody::Statements(body)) => {
                        println!("  body: {{");
                        for item in body.iter() {
                            println!("    [{}]", item.id);
                        }
                        println!("  }}");
                    }
                    Some(FunctionBody::NativeCode) => {
                        println!("  body: (native code)");
                    }
                    None => {
                        println!("  body: (None)");
                    }
                }
            }
            Node::VariableDeclaration(variable) => {
                println!("  name: {}", variable.identifier);
                println!("  body: {{");
                println!("    [{}]", variable.body.id);
                println!("  }}");
                println!("  is_mutable: {}", variable.is_mutable);
            }
            Node::BreakStatement => {}
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

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

pub enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    BreakStatement(BreakStatement),
    ReturnStatement(ReturnStatement),
    Assignment(Assignment),
    IfStatement(IfStatement),
    LoopStatement(LoopStatement),
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
            Node::FunctionDeclaration(_) => {
                panic!("type `function` is not supported");
            }
            | Node::BreakStatement(_)
            | Node::ReturnStatement(_)
            | Node::Assignment(_)
            | Node::IfStatement(_)
            | Node::LoopStatement(_) => {
                panic!("unexpected node");
            }
        }
    }

    pub fn get_pos(&self) -> (usize, usize) {
        match self {
            Self::FunctionDeclaration(node) => node.pos,
            Self::VariableDeclaration(node) => node.pos,
            Self::BreakStatement(node) => node.pos,
            Self::ReturnStatement(node) => node.pos,
            Self::Assignment(node) => node.pos,
            Self::IfStatement(node) => node.pos,
            Self::LoopStatement(node) => node.pos,
            Self::Literal(node) => node.pos,
            Self::BinaryExpr(node) => node.pos,
            Self::CallExpr(node) => node.pos,
            Self::FuncParam(node) => node.pos,
        }
    }

    fn as_function(&self) -> Option<&FunctionDeclaration> {
        match self {
            Node::FunctionDeclaration(decl) => Some(decl),
            _ => None,
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

    fn lookup(ty_identifier: &str) -> Result<Type, String> {
        match ty_identifier {
            "void" => Err("type `void` is invalid".to_owned()),
            "number" => Ok(Type::Number),
            "bool" => Ok(Type::Bool),
            _ => Err("unknown type name".to_owned()),
        }
    }

    fn assert(actual: Type, expected: Type) -> Result<Type, String> {
        if actual == expected {
            Ok(actual)
        } else {
            let message = format!("type mismatched. expected `{}`, found `{}`", expected.get_name(), actual.get_name());
            Err(message)
        }
    }
}

pub enum FunctionBody {
    Statements(Vec<NodeRef>),
    NativeCode,
}

pub struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<FunctionBody>,
    pub params: Vec<NodeRef>,
    pub ret_ty: Type,
    pub pos: (usize, usize),
}

pub struct FuncParam {
    pub identifier: String,
    pub param_index: usize,
    pub ty: Type,
    pub pos: (usize, usize),
}

pub struct VariableDeclaration {
    pub identifier: String,
    pub body: NodeRef,
    pub is_mutable: bool,
    pub ty: Type,
    pub pos: (usize, usize),
}

pub struct BreakStatement {
    pub pos: (usize, usize),
}

pub struct ReturnStatement {
    pub body: Option<NodeRef>,
    pub pos: (usize, usize),
}

pub struct Assignment {
    pub dest: NodeRef,
    pub body: NodeRef,
    pub mode: AssignmentMode,
    pub pos: (usize, usize),
}

pub struct IfStatement {
    pub condition: NodeRef,
    pub then_block: Vec<NodeRef>,
    pub else_block: Vec<NodeRef>,
    pub pos: (usize, usize),
}

pub struct LoopStatement {
    pub body: Vec<NodeRef>,
    pub pos: (usize, usize),
}

pub struct Literal {
    pub value: LiteralValue,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub enum LiteralValue {
    Number(i64),
    Bool(bool),
}

pub struct BinaryExpr {
    pub operator: Operator,
    pub left: NodeRef,
    pub right: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug, Clone)]
pub enum Operator {
    Add,
    Sub,
    Mult,
    Div,
    Mod,
    Equal,
    NotEqual,
    GreaterThan,
    GreaterThanEqual,
    LessThan,
    LessThanEqual,
}

pub struct CallExpr {
    pub callee: NodeRef,
    pub args: Vec<NodeRef>,
    pub ty: Type,
    pub pos: (usize, usize),
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

    fn register_node(&mut self, node: Node) -> NodeRef {
        let node_id = self.source.len();
        self.source.insert(node_id, node);
        NodeRef::new(node_id)
    }

    fn calc_location(&self, node: &parse::Node) -> Result<(usize, usize), SyntaxError> {
        node.calc_location(self.input)
            .map_err(|e| SyntaxError::new(&e))
    }

    fn make_low_error(&self, message: &str, node: &parse::Node) -> SyntaxError {
        let (line, column) = node.calc_location(self.input).unwrap();
        SyntaxError::new(&format!("{} ({}:{})", message, line, column))
    }

    fn make_error(&self, message: &str, node: &Node) -> SyntaxError {
        let (line, column) = node.get_pos();
        SyntaxError::new(&format!("{} ({}:{})", message, line, column))
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
                pos: (1, 1),
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
            pos: (1, 1),
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
            "print_lf",
            vec![],
            Type::Void,
        ));
        ids.push(self.register_builtin(
            "assert_eq",
            vec![("actual", Type::Number), ("expected", Type::Number)],
            Type::Void,
        ));

        ids.extend(self.translate_statements(ast)?);

        // make call main function
        let call_main = parse::Node::new_call_expr(
            parse::Node::new_reference("main", 0),
            vec![],
            0,
        );
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
        match &parser_node {
            parse::Node::Declaration(parser_decl) => {
                match parser_decl.body.as_ref() {
                    parse::Node::Function(func_decl) => {
                        let mut params = Vec::new();
                        for (i, n) in func_decl.params.iter().enumerate() {
                            let param = n.as_func_param();
                            let param_type = match &param.type_identifier {
                                Some(x) => Type::lookup(x).map_err(|e| self.make_low_error(&e, n))?, // TODO: improve error location
                                None => return Err(self.make_low_error("parameter type missing", n)),
                            };
                            // make param node
                            let node = Node::FuncParam(FuncParam {
                                identifier: param.identifier.clone(),
                                param_index: i,
                                ty: param_type,
                                pos: self.calc_location(n)?,
                            });
                            let node_ref = self.register_node(node);
                            params.push(node_ref);
                        }
                        let ret_ty = match &func_decl.ret {
                            Some(x) => Type::lookup(x).map_err(|e| self.make_low_error(&e, parser_node))?, // TODO: improve error location
                            None => Type::Void,
                        };
                        // make function node
                        let decl_node = Node::FunctionDeclaration(FunctionDeclaration {
                            identifier: func_decl.identifier.clone(),
                            params,
                            ret_ty,
                            body: None,
                            pos: self.calc_location(parser_node)?,
                        });
                        let node_ref = self.register_node(decl_node);
                        // add to scope
                        self.scope.add_node(&func_decl.identifier, node_ref);

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
                        let body = match &func_decl.body {
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
                    parse::Node::Variable(var_decl) => {
                        let body_ref = self.translate_expr(&var_decl.body)?;
                        let body = body_ref.get(self.source);
                        let is_mutable = var_decl
                            .attributes
                            .iter()
                            .any(|x| *x == parse::VariableAttribute::Let);
                        let infer_ty = body.get_ty();
                        // NOTE: The fact that type `void` cannot be explicitly declared is used to ensure that variables of type `void` are not declared.
                        let ty = match &var_decl.type_identifier {
                            Some(ident) => {
                                let specified_ty = Type::lookup(ident)
                                    .map_err(|e| self.make_low_error(&e, parser_node))?; // TODO: improve error location
                                Type::assert(infer_ty, specified_ty)
                                    .map_err(|e| self.make_error(&e, body))?
                            }
                            None => infer_ty,
                        };
                        // make node
                        let node = Node::VariableDeclaration(VariableDeclaration {
                            identifier: var_decl.identifier.clone(),
                            body: body_ref,
                            is_mutable,
                            ty,
                            pos: self.calc_location(parser_node)?,
                        });
                        let node_ref = self.register_node(node);
                        // add to scope
                        self.scope.add_node(&var_decl.identifier, node_ref);
                        Ok(node_ref)
                    }
                    _ => panic!("unexpected declaration"),
                }
            }
            parse::Node::BreakStatement(_) => {
                if self.scope.layers.len() == 1 {
                    return Err(self.make_low_error("A break statement cannot be used in global space", parser_node));
                }
                // TODO: check target
                let node = Node::BreakStatement(BreakStatement {
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::Node::ReturnStatement(node) => {
                // TODO: consider type check
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(self.make_low_error("A return statement cannot be used in global space", parser_node));
                }
                let body = match node.body.as_ref() {
                    Some(x) => Some(self.translate_expr(x)?),
                    None => None,
                };
                let node = Node::ReturnStatement(ReturnStatement {
                    body,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::Node::Assignment(statement) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(self.make_low_error("An assignment statement cannot be used in global space", parser_node));
                }
                let dest = self.translate_expr(&statement.dest)?;
                let body = self.translate_expr(&statement.body)?;
                match statement.mode {
                    AssignmentMode::Assign => {
                        let dest_node = dest.get(self.source);
                        let body_node = body.get(self.source);
                        if let Some(_) = dest_node.as_function() {
                            return Err(self.make_error("function is not assignable", dest_node));
                        }
                        let dest_ty = dest_node.get_ty();
                        let body_ty = body_node.get_ty();
                        Type::assert(body_ty, dest_ty)
                            .map_err(|e| self.make_error(&e, body_node))?;
                    },
                    AssignmentMode::AddAssign
                    | AssignmentMode::SubAssign
                    | AssignmentMode::MultAssign
                    | AssignmentMode::DivAssign
                    | AssignmentMode::ModAssign => {
                        let dest_node = dest.get(self.source);
                        let body_node = body.get(self.source);
                        let dest_ty = dest_node.get_ty();
                        Type::assert(dest_ty, Type::Number)
                            .map_err(|e| self.make_error(&e, dest_node))?; // TODO: improve error message
                        let body_ty = body_node.get_ty();
                        Type::assert(body_ty, Type::Number)
                            .map_err(|e| self.make_error(&e, body_node))?;
                    }
                }
                let node = Node::Assignment(Assignment {
                    dest,
                    body,
                    mode: statement.mode,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::Node::IfStatement(if_statement) => {
                fn transform(
                    index: usize,
                    analyzer: &mut Analyzer,
                    parser_node: &parse::Node,
                    items: &Vec<(Box<parse::Node>, Vec<parse::Node>)>,
                    else_block: &Option<Vec<parse::Node>>,
                ) -> Result<Option<NodeRef>, SyntaxError> {
                    match items.get(index) {
                        Some((cond, then_block)) => {
                            let cond_ref = analyzer.translate_expr(cond)?;
                            let cond_node = cond_ref.get(analyzer.source);
                            let cond_ty = cond_node.get_ty();
                            Type::assert(cond_ty, Type::Bool)
                                .map_err(|e| analyzer.make_error(&e, cond_node))?;
                            let then_nodes = analyzer.translate_statements(then_block)?;
                            // next else if part
                            let elif = transform(index + 1, analyzer, parser_node, items, else_block)?;
                            match elif {
                                Some(x) => {
                                    let node = Node::IfStatement(IfStatement {
                                        condition: cond_ref,
                                        then_block: then_nodes,
                                        else_block: vec![x],
                                        pos: analyzer.calc_location(parser_node)?,
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
                                        condition: cond_ref,
                                        then_block: then_nodes,
                                        else_block: else_nodes,
                                        pos: analyzer.calc_location(parser_node)?,
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
                    parser_node,
                    &if_statement.cond_blocks,
                    &if_statement.else_block,
                )? {
                    Some(x) => x,
                    None => panic!("unexpected error: cond blocks is empty"),
                };
                Ok(node_ref)
            }
            parse::Node::LoopStatement(statement) => {
                if self.scope.layers.len() == 1 {
                    return Err(self.make_low_error("A loop statement cannot be used in global space", parser_node));
                }
                let body = self.translate_statements(&statement.body)?;
                let node = Node::LoopStatement(LoopStatement {
                    body,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::Node::Reference(_)
            | parse::Node::NumberLiteral(_)
            | parse::Node::BoolLiteral(_)
            | parse::Node::BinaryExpr(_)
            | parse::Node::CallExpr(_) => {
                // when global scope
                if self.scope.layers.len() == 1 {
                    return Err(self.make_low_error("An expression cannot be used in global space", parser_node));
                }
                self.translate_expr(parser_node)
            }
            parse::Node::Function(_)
            | parse::Node::FuncParam(_)
            | parse::Node::Variable(_) => panic!("unexpected node"),
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
                    None => Err(self.make_low_error("unknown identifier", parser_node)),
                }
            }
            parse::Node::NumberLiteral(node) => {
                let node = Node::Literal(Literal {
                    value: LiteralValue::Number(node.value),
                    ty: Type::Number,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::Node::BoolLiteral(node) => {
                let node = Node::Literal(Literal {
                    value: LiteralValue::Bool(node.value),
                    ty: Type::Bool,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::Node::BinaryExpr(binary_expr) => {
                let left_ref = self.translate_expr(&binary_expr.left)?;
                let right_ref = self.translate_expr(&binary_expr.right)?;
                let left_node = left_ref.get(self.source);
                let right_node = right_ref.get(self.source);
                let left_ty = left_node.get_ty();
                let right_ty = right_node.get_ty();
                let op = match binary_expr.operator.as_str() {
                    "+" => Operator::Add,
                    "-" => Operator::Sub,
                    "*" => Operator::Mult,
                    "/" => Operator::Div,
                    "%" => Operator::Mod,
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
                    | Operator::Div
                    | Operator::Mod => {
                        Type::assert(left_ty, Type::Number)
                            .map_err(|e| self.make_error(&e, left_node))?;
                        Type::assert(right_ty, Type::Number)
                            .map_err(|e| self.make_error(&e, right_node))?;
                        Node::BinaryExpr(BinaryExpr {
                            operator: op,
                            left: left_ref,
                            right: right_ref,
                            ty: Type::Number,
                            pos: self.calc_location(parser_node)?,
                        })
                    }
                    Operator::Equal
                    | Operator::NotEqual
                    | Operator::LessThan
                    | Operator::LessThanEqual
                    | Operator::GreaterThan
                    | Operator::GreaterThanEqual => {
                        Type::assert(right_ty, left_ty)
                            .map_err(|e| self.make_low_error(&e, parser_node))?; // TODO: improve error message
                        Node::BinaryExpr(BinaryExpr {
                            operator: op,
                            left: left_ref,
                            right: right_ref,
                            ty: Type::Bool,
                            pos: self.calc_location(parser_node)?,
                        })
                    }
                };
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::Node::CallExpr(call_expr) => {
                let callee_ref = self.translate_expr(&call_expr.callee)?;
                let callee_node = callee_ref.get(self.source);
                let callee = match callee_node.as_function() {
                    Some(x) => x,
                    None => return Err(self.make_error("function expected", callee_node)),
                };
                let ret_ty = callee.ret_ty;
                let params = callee.params.clone();
                if params.len() != call_expr.args.len() {
                    return Err(self.make_low_error("argument count incorrect", parser_node));
                }
                let mut args = Vec::new();
                for (i, &param_ref) in params.iter().enumerate() {
                    let arg_ref = self.translate_expr(&call_expr.args[i])?;
                    let arg = arg_ref.get(self.source);
                    let param_ty = param_ref.get(self.source).get_ty();
                    let arg_ty = arg.get_ty();
                    Type::assert(arg_ty, param_ty)
                        .map_err(|e| self.make_error(&e, arg))?;
                    args.push(arg_ref);
                }
                let node = Node::CallExpr(CallExpr {
                    callee: callee_ref,
                    args,
                    ty: ret_ty,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            parse::Node::Declaration(_)
            | parse::Node::Function(_)
            | parse::Node::Variable(_)
            | parse::Node::BreakStatement(_)
            | parse::Node::ReturnStatement(_)
            | parse::Node::Assignment(_)
            | parse::Node::IfStatement(_)
            | parse::Node::LoopStatement(_)
            | parse::Node::FuncParam(_) => {
                panic!("unexpected expr node");
            }
        }
    }

    /// Show the resolved graph
    pub fn show_graph(&self) {
        for i in 0..self.source.len() {
            self.show_node(NodeRef::new(i));
        }
    }

    fn show_node(&self, node_ref: NodeRef) {
        let node = node_ref.get(self.source);
        let name = match node {
            Node::FunctionDeclaration(_) => "FunctionDeclaration",
            Node::VariableDeclaration(_) => "VariableDeclaration",
            Node::BreakStatement(_) => "BreakStatement",
            Node::ReturnStatement(_) => "ReturnStatement",
            Node::Assignment(_) => "Assignment",
            Node::IfStatement(_) => "IfStatement",
            Node::LoopStatement(_) => "LoopStatement",
            Node::Literal(_) => "Literal",
            Node::BinaryExpr(_) => "BinaryExpr",
            Node::CallExpr(_) => "CallExpr",
            Node::FuncParam(_) => "FuncParam",
        };
        let (line, column) = node.get_pos();
        println!("[{}] {} ({}:{})", node_ref.id, name, line, column);
        match node {
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
            Node::BreakStatement(_) => {}
            Node::ReturnStatement(node) => {
                match node.body {
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
                for item in statement.body.iter() {
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

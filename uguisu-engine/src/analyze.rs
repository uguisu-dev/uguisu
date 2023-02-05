use crate::ast::{
    self,
    AssignmentMode,
    VariableAttribute,
};
use crate::graph::{
    self,
    ArithmeticOp,
    ArithmeticOperator,
    Assignment,
    BreakStatement,
    CallExpr,
    Declaration,
    FuncParam,
    Function,
    FunctionBody,
    FunctionSignature,
    IfStatement,
    Literal,
    LiteralValue,
    LogicalBinaryOp,
    LogicalBinaryOperator,
    LogicalUnaryOp,
    LogicalUnaryOperator,
    LoopStatement,
    Reference,
    RelationalOp,
    RelationalOperator,
    ReturnStatement,
    Signature,
    Variable,
    VariableSignature,
};
use crate::types::Type;
use crate::SyntaxError;
use std::collections::HashMap;

#[cfg(test)]
mod test;

struct AnalyzeStack {
    frames: Vec<StackFrame>,
    trace: bool,
}

impl AnalyzeStack {
    fn new(trace: bool) -> Self {
        Self {
            frames: vec![StackFrame::new()],
            trace,
        }
    }

    fn push_frame(&mut self) {
        if self.trace { println!("push_frame"); }
        self.frames.insert(0, StackFrame::new());
    }

    fn pop_frame(&mut self) {
        if self.trace { println!("pop_frame"); }
        if self.frames.len() == 1 {
            panic!("Left the root frame.");
        }
        self.frames.remove(0);
    }

    fn set_record(&mut self, identifier: &str, node: graph::NodeRef) {
        if self.trace { println!("set_record (identifier: \"{}\", node_id: [{}])", identifier, node.id); }
        match self.frames.get_mut(0) {
            Some(frame) => {
                frame.table.insert(identifier.to_string(), node);
            }
            None => panic!("frame not found"),
        }
    }

    fn get_record(&self, identifier: &str) -> Option<graph::NodeRef> {
        if self.trace { println!("get_record (identifier: \"{}\")", identifier); }
        for frame in self.frames.iter() {
            match frame.table.get(identifier) {
                Some(&x) => return Some(x),
                None => {}
            }
        }
        None
    }
}

struct StackFrame {
    table: HashMap<String, graph::NodeRef>,
}

impl StackFrame {
    fn new() -> Self {
        Self {
            table: HashMap::new(),
        }
    }
}

pub(crate) struct Analyzer<'a> {
    input: &'a str,
    source: &'a mut HashMap<graph::NodeId, graph::Node>,
    stack: AnalyzeStack,
    trace: bool,
}

impl<'a> Analyzer<'a> {
    pub(crate) fn new(input: &'a str, source: &'a mut HashMap<graph::NodeId, graph::Node>, trace: bool) -> Self {
        Self {
            input,
            source,
            stack: AnalyzeStack::new(trace),
            trace,
        }
    }

    fn register_node(&mut self, node: graph::Node) -> graph::NodeRef {
        let node_id = self.source.len();
        self.source.insert(node_id, node);
        graph::NodeRef::new(node_id)
    }

    fn calc_location(&self, node: &ast::Node) -> Result<(usize, usize), SyntaxError> {
        node.calc_location(self.input).map_err(|e| SyntaxError::new(&e))
    }

    fn make_low_error(&self, message: &str, node: &ast::Node) -> SyntaxError {
        let (line, column) = node.calc_location(self.input).unwrap();
        SyntaxError::new(&format!("{} ({}:{})", message, line, column))
    }

    fn make_error(&self, message: &str, node: &graph::Node) -> SyntaxError {
        let (line, column) = node.get_pos();
        SyntaxError::new(&format!("{} ({}:{})", message, line, column))
    }

    fn register_builtin(
        &mut self,
        name: &str,
        params: Vec<(&str, Type)>,
        ret_ty: Type,
    ) -> graph::NodeRef {
        let mut param_nodes = Vec::new();
        for &(param_name, param_ty) in params.iter() {
            // make param node
            let node = graph::Node::FuncParam(FuncParam {
                identifier: String::from(param_name),
                // param_index: i,
                ty: param_ty,
                pos: (1, 1),
            });
            let node_ref = self.register_node(node);
            param_nodes.push(node_ref);
        }

        let func_node = graph::Node::Function(Function {
            params: param_nodes.clone(),
            ret_ty,
            content: FunctionBody::NativeCode,
            pos: (1, 1),
        });
        let func_node_ref = self.register_node(func_node);

        let signature = Signature::FunctionSignature(FunctionSignature {
            params: param_nodes,
            ret_ty,
        });
        let decl_node = graph::Node::Declaration(Declaration {
            identifier: String::from(name),
            signature,
            body: Some(func_node_ref),
            pos: (1, 1),
        });
        let node_ref = self.register_node(decl_node);

        // add to stack
        self.stack.set_record(name, node_ref);
        node_ref
    }

    fn resolve_node(&self, node_ref: graph::NodeRef) -> graph::NodeRef {
        match node_ref.get(self.source) {
            graph::Node::Reference(reference) => self.resolve_node(reference.dest),
            _ => node_ref,
        }
    }

    /// Generate a resolved graph from a AST.
    pub(crate) fn translate(&mut self, ast: &Vec<ast::Node>) -> Result<Vec<graph::NodeRef>, SyntaxError> {
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
        let call_main = ast::Node::new_call_expr(
            ast::Node::new_reference("main", 0),
            vec![],
            0,
        );
        ids.push(self.translate_expr(&call_main)?);

        Ok(ids)
    }

    fn translate_statements(
        &mut self,
        parser_nodes: &Vec<ast::Node>,
    ) -> Result<Vec<graph::NodeRef>, SyntaxError> {
        let mut ids = Vec::new();
        for parser_node in parser_nodes.iter() {
            ids.push(self.translate_statement(parser_node)?);
        }
        Ok(ids)
    }

    /// Generate a graph node from a statement AST node.
    /// - check if the statement is available in the global or local
    /// - check type compatibility for inner expression
    fn translate_statement(&mut self, parser_node: &ast::Node) -> Result<graph::NodeRef, SyntaxError> {
        if self.trace { println!("enter statement (name: {})", parser_node.get_name()); }
        let result = match &parser_node {
            ast::Node::FunctionDeclaration(func) => {
                let mut func_params = Vec::new();
                for n in func.params.iter() {
                    let param = n.as_func_param();
                    let param_type = match &param.type_identifier {
                        Some(x) => Type::lookup_user_type(x).map_err(|e| self.make_low_error(&e, n))?, // TODO: improve error location
                        None => return Err(self.make_low_error("parameter type missing", n)),
                    };
                    let func_param = FuncParam {
                        identifier: param.identifier.clone(),
                        // param_index: i,
                        ty: param_type,
                        pos: self.calc_location(n)?,
                    };
                    func_params.push(func_param);
                }
                let ret_ty = match &func.ret {
                    Some(x) => Type::lookup_user_type(x).map_err(|e| self.make_low_error(&e, parser_node))?, // TODO: improve error location
                    None => Type::Void,
                };

                // function declaration
                let decl_node_ref = {
                    // params
                    let mut params = Vec::new();
                    for func_param in func_params.iter() {
                        let node = graph::Node::FuncParam(func_param.clone());
                        let node_ref = self.register_node(node);
                        params.push(node_ref);
                    }

                    let signature = Signature::FunctionSignature(FunctionSignature {
                        params,
                        ret_ty,
                    });
                    let node = graph::Node::Declaration(Declaration {
                        identifier: func.identifier.clone(),
                        signature,
                        body: None,
                        pos: self.calc_location(parser_node)?,
                    });
                    let node_ref = self.register_node(node);
                    self.stack.set_record(&func.identifier, node_ref);

                    node_ref
                };

                // function
                {
                    // params
                    let mut params = Vec::new();
                    for func_param in func_params {
                        let node = graph::Node::FuncParam(func_param);
                        let node_ref = self.register_node(node);
                        params.push(node_ref);
                    }

                    // body
                    self.stack.push_frame();
                    let decl_node = decl_node_ref.get(self.source);
                    let decl = decl_node.as_decl().unwrap();
                    let signature = decl.signature.as_function_signature().unwrap();
                    let mut i = 0;
                    loop {
                        let param_ref = match signature.params.get(i) {
                            Some(&x) => x,
                            None => break,
                        };
                        let param_node = param_ref.get(self.source);
                        let param = param_node.as_func_param().unwrap();
                        self.stack.set_record(&param.identifier, param_ref);
                        i += 1;
                    }
                    let func_body = match &func.body {
                        Some(x) => x,
                        None => return Err(self.make_low_error("function declaration cannot be undefined.", parser_node)),
                    };
                    let body = FunctionBody::Statements(self.translate_statements(func_body)?);
                    self.stack.pop_frame();

                    let node = graph::Node::Function(Function {
                        params,
                        ret_ty,
                        content: body,
                        pos: self.calc_location(parser_node)?,
                    });
                    let func_node_ref = self.register_node(node);

                    // link declaration
                    let decl_node = decl_node_ref.get_mut(self.source);
                    let decl = decl_node.as_decl_mut().unwrap();
                    decl.body = Some(func_node_ref);
                }

                Ok(decl_node_ref)
            }
            ast::Node::VariableDeclaration(variable) => {
                let decl_node_ref = {
                    let has_const_attr = variable.attributes.iter().any(|x| *x == VariableAttribute::Const);
                    if has_const_attr {
                        return Err(self.make_low_error("A variable with `const` is no longer supported. Use the `var` keyword instead. \nThis keyword may also be used as a constant values in the future.", parser_node));
                    }
                    let has_let_attr = variable.attributes.iter().any(|x| *x == VariableAttribute::Let);
                    if has_let_attr {
                        return Err(self.make_low_error("A variable with `let` is no longer supported. Use the `var` keyword instead.", parser_node));
                    }

                    // NOTE: The fact that type `void` cannot be explicitly declared is used to ensure that variables of type `void` are not declared.
                    let specified_ty = match &variable.type_identifier {
                        Some(ident) => Some(Type::lookup_user_type(ident).map_err(|e| self.make_low_error(&e, parser_node))?), // TODO: improve error location
                        None => None,
                    };

                    let signature = Signature::VariableSignature(VariableSignature {
                        specified_ty,
                    });
                    let node = graph::Node::Declaration(Declaration {
                        identifier: variable.identifier.clone(),
                        signature,
                        body: None,
                        pos: self.calc_location(parser_node)?,
                    });
                    let node_ref = self.register_node(node);
                    self.stack.set_record(&variable.identifier, node_ref);
                    node_ref
                };

                {
                    let variable_body = match &variable.body {
                        Some(x) => x,
                        None => return Err(self.make_low_error("variable declaration cannot be undefined.", parser_node)),
                    };
                    let body_ref = self.translate_expr(variable_body)?;
                    let body_node = body_ref.get(self.source);
                    let body_ty = body_node.get_ty(self.source).map_err(|e| self.make_error(&e, body_node))?;
                    if body_ty == Type::Function {
                        return Err(self.make_error("type `function` is not supported", body_node));
                    }
                    let decl_node = decl_node_ref.get(self.source);
                    let decl = decl_node.as_decl().unwrap();
                    let signature = decl.signature.as_variable_signature().unwrap();
                    let ty = match signature.specified_ty {
                        Some(x) => Type::assert(body_ty, x).map_err(|e| self.make_error(&e, body_node))?,
                        None => body_ty,
                    };

                    let var_node = graph::Node::Variable(Variable {
                        content: body_ref,
                        ty,
                        pos: self.calc_location(parser_node)?,
                    });
                    let var_node_ref = self.register_node(var_node);

                    // link declaration
                    let decl_node = decl_node_ref.get_mut(self.source);
                    let decl = decl_node.as_decl_mut().unwrap();
                    decl.body = Some(var_node_ref);
                }

                Ok(decl_node_ref)
            }
            ast::Node::BreakStatement(_) => {
                if self.stack.frames.len() == 1 {
                    return Err(self.make_low_error("A break statement cannot be used in global space", parser_node));
                }
                // TODO: check target
                let node = graph::Node::BreakStatement(BreakStatement {
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            ast::Node::ReturnStatement(node) => {
                // TODO: consider type check
                // when global scope
                if self.stack.frames.len() == 1 {
                    return Err(self.make_low_error("A return statement cannot be used in global space", parser_node));
                }
                let body = match node.body.as_ref() {
                    Some(x) => {
                        let body_ref = self.translate_expr(x)?;
                        let body_node = body_ref.get(self.source);
                        let body_ty = body_node.get_ty(self.source).map_err(|e| self.make_error(&e, body_node))?;
                        if body_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", body_node));
                        }
                        Some(body_ref)
                    }
                    None => None,
                };
                let node = graph::Node::ReturnStatement(ReturnStatement {
                    body,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            ast::Node::Assignment(statement) => {
                // when global scope
                if self.stack.frames.len() == 1 {
                    return Err(self.make_low_error("An assignment statement cannot be used in global space", parser_node));
                }
                let dest = self.translate_expr(&statement.dest)?;
                let body = self.translate_expr(&statement.body)?;
                match statement.mode {
                    AssignmentMode::Assign => {
                        let dest_node = dest.get(self.source);
                        let body_node = body.get(self.source);
                        let dest_ty = dest_node.get_ty(self.source).map_err(|e| self.make_low_error(&e, parser_node))?;
                        let body_ty = body_node.get_ty(self.source).map_err(|e| self.make_error(&e, body_node))?;
                        if dest_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", dest_node));
                        }
                        if body_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", body_node));
                        }
                        Type::assert(body_ty, dest_ty).map_err(|e| self.make_error(&e, body_node))?;
                    },
                    AssignmentMode::AddAssign
                    | AssignmentMode::SubAssign
                    | AssignmentMode::MultAssign
                    | AssignmentMode::DivAssign
                    | AssignmentMode::ModAssign => {
                        let dest_node = dest.get(self.source);
                        let body_node = body.get(self.source);
                        let dest_ty = dest_node.get_ty(self.source).map_err(|e| self.make_low_error(&e, parser_node))?;
                        Type::assert(dest_ty, Type::Number).map_err(|e| self.make_error(&e, dest_node))?; // TODO: improve error message
                        let body_ty = body_node.get_ty(self.source).map_err(|e| self.make_error(&e, body_node))?;
                        Type::assert(body_ty, Type::Number).map_err(|e| self.make_error(&e, body_node))?;
                    }
                }
                let node = graph::Node::Assignment(Assignment {
                    dest,
                    body,
                    mode: statement.mode,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            ast::Node::IfStatement(if_statement) => {
                fn transform(
                    index: usize,
                    analyzer: &mut Analyzer,
                    parser_node: &ast::Node,
                    items: &Vec<(Box<ast::Node>, Vec<ast::Node>)>,
                    else_block: &Option<Vec<ast::Node>>,
                ) -> Result<Option<graph::NodeRef>, SyntaxError> {
                    match items.get(index) {
                        Some((cond, then_block)) => {
                            let cond_ref = analyzer.translate_expr(cond)?;
                            let cond_node = cond_ref.get(analyzer.source);
                            let cond_ty = cond_node.get_ty(analyzer.source).map_err(|e| analyzer.make_error(&e, cond_node))?;
                            Type::assert(cond_ty, Type::Bool).map_err(|e| analyzer.make_error(&e, cond_node))?;
                            let then_nodes = analyzer.translate_statements(then_block)?;
                            // next else if part
                            let elif = transform(index + 1, analyzer, parser_node, items, else_block)?;
                            match elif {
                                Some(x) => {
                                    let node = graph::Node::IfStatement(IfStatement {
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
                                    let node = graph::Node::IfStatement(IfStatement {
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
            ast::Node::LoopStatement(statement) => {
                if self.stack.frames.len() == 1 {
                    return Err(self.make_low_error("A loop statement cannot be used in global space", parser_node));
                }
                let body = self.translate_statements(&statement.body)?;
                let node = graph::Node::LoopStatement(LoopStatement {
                    body,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            ast::Node::Reference(_)
            | ast::Node::NumberLiteral(_)
            | ast::Node::BoolLiteral(_)
            | ast::Node::BinaryExpr(_)
            | ast::Node::UnaryOp(_)
            | ast::Node::CallExpr(_) => {
                // when global scope
                if self.stack.frames.len() == 1 {
                    return Err(self.make_low_error("An expression cannot be used in global space", parser_node));
                }
                let expr_ref = self.translate_expr(parser_node)?;
                let expr_node = expr_ref.get(self.source);
                let expr_ty = expr_node.get_ty(self.source).map_err(|e| self.make_error(&e, expr_node))?;
                if expr_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", expr_node));
                }
                Ok(expr_ref)
            }
            ast::Node::FuncParam(_) => panic!("unexpected node"),
        };
        if self.trace { println!("leave statement (name: {})", parser_node.get_name()); }
        result
    }

    /// Generate a graph node from a expression AST node.
    /// - infer type for the expression
    /// - check type compatibility for inner expression
    /// - generate syntax errors
    fn translate_expr(&mut self, parser_node: &ast::Node) -> Result<graph::NodeRef, SyntaxError> {
        if self.trace { println!("enter expr (name: {})", parser_node.get_name()); }
        let result = match parser_node {
            ast::Node::Reference(reference) => {
                let dest_ref = match self.stack.get_record(&reference.identifier) {
                    Some(x) => x,
                    None => return Err(self.make_low_error("unknown identifier", parser_node)),
                };
                let dest_node = dest_ref.get(self.source);
                let dest_ty = dest_node.get_ty(self.source).map_err(|e| self.make_error(&e, dest_node))?;
                let node = graph::Node::Reference(Reference {
                    dest: dest_ref,
                    ty: dest_ty,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            ast::Node::NumberLiteral(node) => {
                let node = graph::Node::Literal(Literal {
                    value: LiteralValue::Number(node.value),
                    ty: Type::Number,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            ast::Node::BoolLiteral(node) => {
                let node = graph::Node::Literal(Literal {
                    value: LiteralValue::Bool(node.value),
                    ty: Type::Bool,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            ast::Node::UnaryOp(unary_op) => {
                let expr_ref = self.translate_expr(&unary_op.expr)?;
                let expr_node = expr_ref.get(self.source);
                let expr_ty = expr_node.get_ty(self.source).map_err(|e| self.make_error(&e, expr_node))?;
                if expr_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", expr_node));
                }
                let op_str = unary_op.operator.as_str();
                let op = match op_str {
                    "!" => LogicalUnaryOperator::Not,
                    _ => return Err(self.make_low_error("unexpected operation", parser_node)),
                };
                Type::assert(expr_ty, Type::Bool).map_err(|e| self.make_error(&e, expr_node))?;
                let node = graph::Node::LogicalUnaryOp(LogicalUnaryOp {
                    operator: op,
                    expr: expr_ref,
                    ty: Type::Bool,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            ast::Node::BinaryExpr(binary_expr) => {
                let left_ref = self.translate_expr(&binary_expr.left)?;
                let right_ref = self.translate_expr(&binary_expr.right)?;
                let left_node = left_ref.get(self.source);
                let right_node = right_ref.get(self.source);
                let left_ty = left_node.get_ty(self.source).map_err(|e| self.make_error(&e, left_node))?;
                let right_ty = right_node.get_ty(self.source).map_err(|e| self.make_error(&e, right_node))?;
                if left_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", left_node));
                }
                if right_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", right_node));
                }
                let op_str = binary_expr.operator.as_str();
                // Arithmetic Operation
                {
                    let op = match op_str {
                        "+" => Some(ArithmeticOperator::Add),
                        "-" => Some(ArithmeticOperator::Sub),
                        "*" => Some(ArithmeticOperator::Mult),
                        "/" => Some(ArithmeticOperator::Div),
                        "%" => Some(ArithmeticOperator::Mod),
                        _ => None,
                    };
                    if let Some(op) = op {
                        Type::assert(left_ty, Type::Number).map_err(|e| self.make_error(&e, left_node))?;
                        Type::assert(right_ty, Type::Number).map_err(|e| self.make_error(&e, right_node))?;
                        let node = graph::Node::ArithmeticOp(ArithmeticOp {
                            operator: op,
                            left: left_ref,
                            right: right_ref,
                            ty: Type::Number,
                            pos: self.calc_location(parser_node)?,
                        });
                        let node_ref = self.register_node(node);
                        return Ok(node_ref);
                    }
                }
                // Relational Operation
                {
                    let op = match op_str {
                        "==" => Some(RelationalOperator::Equal),
                        "!=" => Some(RelationalOperator::NotEqual),
                        "<" => Some(RelationalOperator::LessThan),
                        "<=" => Some(RelationalOperator::LessThanEqual),
                        ">" => Some(RelationalOperator::GreaterThan),
                        ">=" => Some(RelationalOperator::GreaterThanEqual),
                        _ => None,
                    };
                    if let Some(op) = op {
                        Type::assert(right_ty, left_ty).map_err(|e| self.make_low_error(&e, parser_node))?; // TODO: improve error message
                        let node = graph::Node::RelationalOp(RelationalOp {
                            operator: op,
                            relation_type: left_ty,
                            left: left_ref,
                            right: right_ref,
                            ty: Type::Bool,
                            pos: self.calc_location(parser_node)?,
                        });
                        let node_ref = self.register_node(node);
                        return Ok(node_ref);
                    }
                }
                // Logical Operation
                {
                    let op = match op_str {
                        "&&" => Some(LogicalBinaryOperator::And),
                        "||" => Some(LogicalBinaryOperator::Or),
                        _ => None,
                    };
                    if let Some(op) = op {
                        Type::assert(left_ty, Type::Bool).map_err(|e| self.make_error(&e, left_node))?;
                        Type::assert(right_ty, Type::Bool).map_err(|e| self.make_error(&e, right_node))?;
                        let node = graph::Node::LogicalBinaryOp(LogicalBinaryOp {
                            operator: op,
                            left: left_ref,
                            right: right_ref,
                            ty: Type::Bool,
                            pos: self.calc_location(parser_node)?,
                        });
                        let node_ref = self.register_node(node);
                        return Ok(node_ref);
                    }
                }
                Err(self.make_low_error("unexpected operation", parser_node))
            }
            ast::Node::CallExpr(call_expr) => {
                let callee_ref = self.translate_expr(&call_expr.callee)?;
                let callee = callee_ref.get(self.source);
                let callee_func_ref = self.resolve_node(callee_ref);
                let callee_func_node = callee_func_ref.get(self.source);
                let callee_func = callee_func_node.as_decl().map_err(|e| self.make_error(&e, callee))?;
                let signature = callee_func.signature.as_function_signature().map_err(|e| self.make_error(&e, callee))?;
                let ret_ty = signature.ret_ty;
                let params = signature.params.clone();
                if params.len() != call_expr.args.len() {
                    return Err(self.make_low_error("argument count incorrect", parser_node));
                }
                let mut args = Vec::new();
                for (i, &param_ref) in params.iter().enumerate() {
                    let arg_ref = self.translate_expr(&call_expr.args[i])?;
                    let arg_node = arg_ref.get(self.source);
                    let param_node = param_ref.get(self.source);
                    let param_ty = param_node.get_ty(self.source).map_err(|e| self.make_error(&e, param_node))?;
                    let arg_ty = arg_node.get_ty(self.source).map_err(|e| self.make_error(&e, arg_node))?;
                    if param_ty == Type::Function {
                        return Err(self.make_error("type `function` is not supported", param_node));
                    }
                    if arg_ty == Type::Function {
                        return Err(self.make_error("type `function` is not supported", arg_node));
                    }
                    Type::assert(arg_ty, param_ty).map_err(|e| self.make_error(&e, arg_node))?;
                    args.push(arg_ref);
                }
                let node = graph::Node::CallExpr(CallExpr {
                    callee: callee_ref,
                    args,
                    ty: ret_ty,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            ast::Node::FunctionDeclaration(_)
            | ast::Node::VariableDeclaration(_)
            | ast::Node::BreakStatement(_)
            | ast::Node::ReturnStatement(_)
            | ast::Node::Assignment(_)
            | ast::Node::IfStatement(_)
            | ast::Node::LoopStatement(_)
            | ast::Node::FuncParam(_) => {
                panic!("unexpected expr node");
            }
        };
        if self.trace { println!("leave expr (name: {})", parser_node.get_name()); }
        result
    }

    /// Show the resolved graph
    pub(crate) fn show_graph(&self) {
        for i in 0..self.source.len() {
            self.show_node(graph::NodeRef::new(i));
        }
    }

    fn show_node(&self, node_ref: graph::NodeRef) {
        graph::show_node(node_ref, self.source);
    }
}

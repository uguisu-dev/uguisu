use crate::ast;
use crate::ast::{
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
    FuncParam,
    FunctionBody,
    FunctionDeclaration,
    IfStatement,
    Literal,
    LiteralValue,
    LogicalBinaryOp,
    LogicalBinaryOperator,
    LoopStatement,
    Reference,
    RelationalOp,
    RelationalOperator,
    ReturnStatement,
    VariableDeclaration,
    LogicalUnaryOperator,
    LogicalUnaryOp,
};
use crate::types::Type;
use crate::SyntaxError;
use std::collections::HashMap;

#[cfg(test)]
mod test;

struct AnalyzeStack {
    frames: Vec<StackFrame>,
}

impl AnalyzeStack {
    fn new() -> Self {
        Self {
            frames: vec![StackFrame::new()],
        }
    }

    fn push_frame(&mut self) {
        self.frames.insert(0, StackFrame::new());
    }

    fn pop_frame(&mut self) {
        if self.frames.len() == 1 {
            panic!("Left the root frame.");
        }
        self.frames.remove(0);
    }

    fn set_record(&mut self, identifier: &str, node: graph::NodeRef) {
        match self.frames.get_mut(0) {
            Some(frame) => {
                frame.table.insert(identifier.to_string(), node);
            }
            None => panic!("frame not found"),
        }
    }

    fn get_record(&self, identifier: &str) -> Option<graph::NodeRef> {
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
}

impl<'a> Analyzer<'a> {
    pub(crate) fn new(input: &'a str, source: &'a mut HashMap<graph::NodeId, graph::Node>) -> Self {
        Self {
            input,
            source,
            stack: AnalyzeStack::new(),
        }
    }

    fn register_node(&mut self, node: graph::Node) -> graph::NodeRef {
        let node_id = self.source.len();
        self.source.insert(node_id, node);
        graph::NodeRef::new(node_id)
    }

    fn calc_location(&self, node: &ast::Node) -> Result<(usize, usize), SyntaxError> {
        node.calc_location(self.input)
            .map_err(|e| SyntaxError::new(&e))
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
        for (_i, &(param_name, param_ty)) in params.iter().enumerate() {
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
        // make function node
        let decl_node = graph::Node::FunctionDeclaration(FunctionDeclaration {
            identifier: String::from(name),
            params: param_nodes,
            ret_ty,
            body: Some(FunctionBody::NativeCode),
            pos: (1, 1),
        });
        let node_ref = self.register_node(decl_node);
        // add to stack
        self.stack.set_record(name, node_ref);
        node_ref
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
        match &parser_node {
            ast::Node::Declaration(parser_decl) => {
                match parser_decl.body.as_ref() {
                    ast::Node::Function(func_decl) => {
                        let mut params = Vec::new();
                        for (_i, n) in func_decl.params.iter().enumerate() {
                            let param = n.as_func_param();
                            let param_type = match &param.type_identifier {
                                Some(x) => Type::lookup_user_type(x).map_err(|e| self.make_low_error(&e, n))?, // TODO: improve error location
                                None => return Err(self.make_low_error("parameter type missing", n)),
                            };
                            // make param node
                            let node = graph::Node::FuncParam(FuncParam {
                                identifier: param.identifier.clone(),
                                // param_index: i,
                                ty: param_type,
                                pos: self.calc_location(n)?,
                            });
                            let node_ref = self.register_node(node);
                            params.push(node_ref);
                        }
                        let ret_ty = match &func_decl.ret {
                            Some(x) => Type::lookup_user_type(x).map_err(|e| self.make_low_error(&e, parser_node))?, // TODO: improve error location
                            None => Type::Void,
                        };
                        // make function node
                        let decl_node = graph::Node::FunctionDeclaration(FunctionDeclaration {
                            identifier: func_decl.identifier.clone(),
                            params,
                            ret_ty,
                            body: None,
                            pos: self.calc_location(parser_node)?,
                        });
                        let node_ref = self.register_node(decl_node);
                        // add to stack
                        self.stack.set_record(&func_decl.identifier, node_ref);

                        // define body
                        self.stack.push_frame();
                        let mut i = 0;
                        loop {
                            let decl = match node_ref.get(self.source) {
                                graph::Node::FunctionDeclaration(x) => x,
                                _ => panic!("function expected"),
                            };
                            let param = match decl.params.get(i) {
                                Some(&x) => x,
                                None => break,
                            };
                            let param_node = match param.get(self.source) {
                                graph::Node::FuncParam(x) => x,
                                _ => panic!("function parameter expected"),
                            };
                            // add to stack
                            self.stack.set_record(&param_node.identifier, param);
                            i += 1;
                        }
                        let body = match &func_decl.body {
                            Some(body_nodes) => Some(FunctionBody::Statements(self.translate_statements(body_nodes)?)),
                            None => None,
                        };
                        let decl = match node_ref.get_mut(self.source) {
                            graph::Node::FunctionDeclaration(x) => x,
                            _ => panic!("function expected"),
                        };
                        decl.body = body;
                        self.stack.pop_frame();

                        Ok(node_ref)
                    }
                    ast::Node::Variable(var_decl) => {
                        let body_ref = self.translate_expr(&var_decl.body)?;
                        let body = body_ref.get(self.source);
                        let has_const_attr = var_decl
                            .attributes
                            .iter()
                            .any(|x| *x == VariableAttribute::Const);
                        if has_const_attr {
                            return Err(self.make_low_error("A variable with `const` is no longer supported. Use the `var` keyword instead. Also, This keyword may also be used as a constant values in the future.", parser_node));
                        }
                        let has_let_attr = var_decl
                            .attributes
                            .iter()
                            .any(|x| *x == VariableAttribute::Let);
                        if has_let_attr {
                            return Err(self.make_low_error("A variable with `let` is no longer supported. Use the `var` keyword instead.", parser_node));
                        }
                        let body_ty = body.get_ty()
                            .map_err(|e| self.make_error(&e, body))?;
                        if body_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", body));
                        }
                        // NOTE: The fact that type `void` cannot be explicitly declared is used to ensure that variables of type `void` are not declared.
                        let ty = match &var_decl.type_identifier {
                            Some(ident) => {
                                let specified_ty = Type::lookup_user_type(ident)
                                    .map_err(|e| self.make_low_error(&e, parser_node))?; // TODO: improve error location
                                Type::assert(body_ty, specified_ty)
                                    .map_err(|e| self.make_error(&e, body))?
                            }
                            None => body_ty,
                        };
                        // make node
                        let node = graph::Node::VariableDeclaration(VariableDeclaration {
                            identifier: var_decl.identifier.clone(),
                            body: body_ref,
                            ty,
                            pos: self.calc_location(parser_node)?,
                        });
                        let node_ref = self.register_node(node);
                        // add to stack
                        self.stack.set_record(&var_decl.identifier, node_ref);
                        Ok(node_ref)
                    }
                    _ => panic!("unexpected declaration"),
                }
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
                    Some(x) => Some(self.translate_expr(x)?),
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
                        let dest_ty = dest_node.get_ty()
                            .map_err(|e| self.make_low_error(&e, parser_node))?;
                        let body_ty = body_node.get_ty()
                            .map_err(|e| self.make_error(&e, body_node))?;
                        if dest_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", dest_node));
                        }
                        if body_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", body_node));
                        }
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
                        let dest_ty = dest_node.get_ty()
                            .map_err(|e| self.make_low_error(&e, parser_node))?;
                        Type::assert(dest_ty, Type::Number)
                            .map_err(|e| self.make_error(&e, dest_node))?; // TODO: improve error message
                        let body_ty = body_node.get_ty()
                            .map_err(|e| self.make_error(&e, body_node))?;
                        Type::assert(body_ty, Type::Number)
                            .map_err(|e| self.make_error(&e, body_node))?;
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
                            let cond_ty = cond_node.get_ty()
                                .map_err(|e| analyzer.make_error(&e, cond_node))?;
                            Type::assert(cond_ty, Type::Bool)
                                .map_err(|e| analyzer.make_error(&e, cond_node))?;
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
                self.translate_expr(parser_node)
            }
            ast::Node::Function(_)
            | ast::Node::FuncParam(_)
            | ast::Node::Variable(_) => panic!("unexpected node"),
        }
    }

    /// Generate a graph node from a expression AST node.
    /// - infer type for the expression
    /// - check type compatibility for inner expression
    fn translate_expr(&mut self, parser_node: &ast::Node) -> Result<graph::NodeRef, SyntaxError> {
        match parser_node {
            ast::Node::Reference(reference) => {
                let dest_ref = match self.stack.get_record(&reference.identifier) {
                    Some(x) => x,
                    None => return Err(self.make_low_error("unknown identifier", parser_node)),
                };
                let dest_node = dest_ref.get(self.source);
                let dest_ty = dest_node.get_ty()
                    .map_err(|e| self.make_error(&e, dest_node))?;
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
                let expr_ty = expr_node.get_ty()
                    .map_err(|e| self.make_error(&e, expr_node))?;
                if expr_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", expr_node));
                }
                let op_str = unary_op.operator.as_str();
                let op = match op_str {
                    "!" => LogicalUnaryOperator::Not,
                    _ => return Err(self.make_low_error("unexpected operation", parser_node)),
                };
                Type::assert(expr_ty, Type::Bool)
                    .map_err(|e| self.make_error(&e, expr_node))?;
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
                let left_ty = left_node.get_ty()
                    .map_err(|e| self.make_error(&e, left_node))?;
                let right_ty = right_node.get_ty()
                    .map_err(|e| self.make_error(&e, right_node))?;
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
                        Type::assert(left_ty, Type::Number)
                            .map_err(|e| self.make_error(&e, left_node))?;
                        Type::assert(right_ty, Type::Number)
                            .map_err(|e| self.make_error(&e, right_node))?;
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
                        Type::assert(right_ty, left_ty)
                            .map_err(|e| self.make_low_error(&e, parser_node))?; // TODO: improve error message
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
                        Type::assert(left_ty, Type::Bool)
                            .map_err(|e| self.make_error(&e, left_node))?;
                        Type::assert(right_ty, Type::Bool)
                            .map_err(|e| self.make_error(&e, right_node))?;
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
                let callee_container_ref = self.translate_expr(&call_expr.callee)?;
                let callee_container_node = callee_container_ref.get(self.source); // node: reference -> declaration -> function
                let callee_node = match callee_container_node.as_reference() {
                    Some(x) => x.dest.get(self.source),
                    None => return Err(self.make_error("reference expected", callee_container_node)),
                };
                let callee = match callee_node.as_function() {
                    Some(x) => x,
                    None => return Err(self.make_error("function expected", callee_container_node)),
                };
                let ret_ty = callee.ret_ty;
                let params = callee.params.clone();
                if params.len() != call_expr.args.len() {
                    return Err(self.make_low_error("argument count incorrect", parser_node));
                }
                let mut args = Vec::new();
                for (i, &param_ref) in params.iter().enumerate() {
                    let arg_ref = self.translate_expr(&call_expr.args[i])?;
                    let arg_node = arg_ref.get(self.source);
                    let param_node = param_ref.get(self.source);
                    let param_ty = param_node.get_ty()
                        .map_err(|e| self.make_error(&e, param_node))?;
                    let arg_ty = arg_node.get_ty()
                        .map_err(|e| self.make_error(&e, arg_node))?;
                    if param_ty == Type::Function {
                        return Err(self.make_error("type `function` is not supported", param_node));
                    }
                    if arg_ty == Type::Function {
                        return Err(self.make_error("type `function` is not supported", arg_node));
                    }
                    Type::assert(arg_ty, param_ty)
                        .map_err(|e| self.make_error(&e, arg_node))?;
                    args.push(arg_ref);
                }
                let node = graph::Node::CallExpr(CallExpr {
                    callee: callee_container_ref,
                    args,
                    ty: ret_ty,
                    pos: self.calc_location(parser_node)?,
                });
                let node_ref = self.register_node(node);
                Ok(node_ref)
            }
            ast::Node::Declaration(_)
            | ast::Node::Function(_)
            | ast::Node::Variable(_)
            | ast::Node::BreakStatement(_)
            | ast::Node::ReturnStatement(_)
            | ast::Node::Assignment(_)
            | ast::Node::IfStatement(_)
            | ast::Node::LoopStatement(_)
            | ast::Node::FuncParam(_) => {
                panic!("unexpected expr node");
            }
        }
    }

    /// Show the resolved graph
    pub(crate) fn show_graph(&self) {
        for i in 0..self.source.len() {
            self.show_node(graph::NodeRef::new(i));
        }
    }

    fn show_node(&self, node_ref: graph::NodeRef) {
        let node = node_ref.get(self.source);
        let name = match node {
            graph::Node::FunctionDeclaration(_) => "FunctionDeclaration",
            graph::Node::VariableDeclaration(_) => "VariableDeclaration",
            graph::Node::BreakStatement(_) => "BreakStatement",
            graph::Node::ReturnStatement(_) => "ReturnStatement",
            graph::Node::Assignment(_) => "Assignment",
            graph::Node::IfStatement(_) => "IfStatement",
            graph::Node::LoopStatement(_) => "LoopStatement",
            graph::Node::Reference(_) => "Reference",
            graph::Node::Literal(_) => "Literal",
            graph::Node::RelationalOp(_) => "RelationalOp",
            graph::Node::LogicalBinaryOp(_) => "LogicalBinaryOp",
            graph::Node::ArithmeticOp(_) => "ArithmeticOp",
            graph::Node::LogicalUnaryOp(_) => "LogicalUnaryOp",
            graph::Node::CallExpr(_) => "CallExpr",
            graph::Node::FuncParam(_) => "FuncParam",
        };
        let (line, column) = node.get_pos();
        println!("[{}] {} ({}:{})", node_ref.id, name, line, column);
        match node {
            graph::Node::FunctionDeclaration(func) => {
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
            graph::Node::VariableDeclaration(variable) => {
                println!("  name: {}", variable.identifier);
                println!("  body: {{");
                println!("    [{}]", variable.body.id);
                println!("  }}");
            }
            graph::Node::BreakStatement(_) => {}
            graph::Node::ReturnStatement(node) => {
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
            graph::Node::Assignment(statement) => {
                println!("  dest: {{");
                println!("    [{}]", statement.dest.id);
                println!("  }}");
                println!("  body: {{");
                println!("    [{}]", statement.body.id);
                println!("  }}");
            }
            graph::Node::IfStatement(if_statement) => {
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
            graph::Node::LoopStatement(statement) => {
                println!("  body: {{");
                for item in statement.body.iter() {
                    println!("    [{}]", item.id);
                }
                println!("  }}");
            }
            graph::Node::Reference(x) => {
                println!("  dest: {{");
                println!("    [{}]", x.dest.id);
                println!("  }}");
            }
            graph::Node::Literal(literal) => {
                println!("  value: {:?}", literal.value);
            }
            graph::Node::RelationalOp(expr) => {
                println!("  operator: {:?}", expr.operator);
                println!("  left: {{");
                println!("    [{}]", expr.left.id);
                println!("  }}");
                println!("  right: {{");
                println!("    [{}]", expr.right.id);
                println!("  }}");
            },
            graph::Node::LogicalBinaryOp(expr) => {
                println!("  operator: {:?}", expr.operator);
                println!("  left: {{");
                println!("    [{}]", expr.left.id);
                println!("  }}");
                println!("  right: {{");
                println!("    [{}]", expr.right.id);
                println!("  }}");
            },
            graph::Node::ArithmeticOp(expr) => {
                println!("  operator: {:?}", expr.operator);
                println!("  left: {{");
                println!("    [{}]", expr.left.id);
                println!("  }}");
                println!("  right: {{");
                println!("    [{}]", expr.right.id);
                println!("  }}");
            },
            graph::Node::LogicalUnaryOp(op) => {
                println!("  operator: {:?}", op.operator);
                println!("  expr: {{");
                println!("    [{}]", op.expr.id);
                println!("  }}");
            },
            graph::Node::CallExpr(call_expr) => {
                println!("  callee: {{");
                println!("    [{}]", call_expr.callee.id);
                println!("  }}");
                println!("  args: {{");
                for arg in call_expr.args.iter() {
                    println!("    [{}]", arg.id);
                }
                println!("  }}");
            }
            graph::Node::FuncParam(func_param) => {
                println!("  name: {}", func_param.identifier);
            }
        }
    }
}

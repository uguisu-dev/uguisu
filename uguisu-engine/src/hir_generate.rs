use crate::ast::{
    self,
    AssignmentMode,
    VariableAttribute,
};
use crate::builtin;
use crate::builtin::BuiltinInfo;
use crate::hir::{
    ArithmeticOperator,
    FuncParam,
    FunctionBody,
    FunctionSignature,
    LiteralValue,
    LogicalBinaryOperator,
    LogicalUnaryOperator,
    Node,
    NodeId,
    RelationalOperator,
    ResolverStack,
    Signature,
    StructDeclField,
    StructSignature,
    SymbolTable,
    Type,
    VariableSignature,
};
use crate::SyntaxError;
use std::collections::BTreeMap;

pub(crate) struct HirGenerator<'a> {
    source_code: &'a str,
    ast: &'a Vec<ast::Node>,
    node_map: &'a mut BTreeMap<NodeId, Node>,
    symbol_table: &'a mut SymbolTable,
    resolver: ResolverStack,
    trace: bool,
}

impl<'a> HirGenerator<'a> {
    pub(crate) fn new(
        source_code: &'a str,
        ast: &'a Vec<ast::Node>,
        node_map: &'a mut BTreeMap<NodeId, Node>,
        symbol_table: &'a mut SymbolTable,
        trace: bool,
    ) -> Self {
        let resolver = ResolverStack::new(trace);
        Self {
            source_code,
            ast,
            node_map,
            symbol_table,
            resolver,
            trace,
        }
    }

    fn register_node(&mut self, node: Node) -> NodeId {
        let node_id = NodeId::new(self.node_map.len());
        if self.trace { println!("new node: {} [{}]", node.get_name(), node_id); }
        self.node_map.insert(node_id, node);
        self.symbol_table.new_record(node_id);
        node_id
    }

    fn calc_location(&self, node: &ast::Node) -> Result<(usize, usize), SyntaxError> {
        crate::parse::calc_location(node.get_pos(), self.source_code).map_err(|e| SyntaxError::new(&e))
    }

    fn make_low_error(&self, message: &str, node: &ast::Node) -> SyntaxError {
        let (line, column) = self.calc_location(node).unwrap();
        SyntaxError::new(&format!("{} ({}:{})", message, line, column))
    }

    fn make_error(&self, message: &str, node_id: NodeId) -> SyntaxError {
        match self.symbol_table.get(node_id).pos {
            Some((line, column)) => SyntaxError::new(&format!("{} ({}:{})", message, line, column)),
            None => SyntaxError::new(&format!("{}", message)),
        }
    }

    fn get_ty_or_err(&self, node_id: NodeId) -> Result<Type, SyntaxError> {
        match self.symbol_table.get(node_id).ty {
            Some(x) => Ok(x),
            None => Err(self.make_error("type not resolved", node_id)),
        }
    }

    fn get_ty_or_low_err(&self, node_id: NodeId, parser_node: &ast::Node) -> Result<Type, SyntaxError> {
        match self.symbol_table.get(node_id).ty {
            Some(x) => Ok(x),
            None => Err(self.make_low_error("type not resolved", parser_node)),
        }
    }

    fn resolve_node(&self, node_id: NodeId) -> NodeId {
        match node_id.get(self.node_map) {
            Node::Reference(reference) => self.resolve_node(reference.dest),
            _ => node_id,
        }
    }

    fn define_variable_decl(&mut self, parser_node: &ast::Node, body: &ast::Node, decl_node_id: NodeId) -> Result<(), SyntaxError> {
        let body_id = self.generate_expr(body)?;
        let body_ty = self.get_ty_or_err(body_id)?;
        if body_ty == Type::Function {
            return Err(self.make_error("type `function` is not supported", body_id));
        }
        if body_ty == Type::Void {
            return Err(self.make_error("A function call that does not return a value cannot be used as an expression.", body_id));
        }
        let decl = decl_node_id.get(self.node_map).as_decl().unwrap();
        let signature = match &decl.signature {
            Signature::VariableSignature(x) => x,
            Signature::FunctionSignature(_) => {
                return Err(self.make_low_error("type `function` is not supported", parser_node));
            }
            Signature::StructSignature(_) => {
                return Err(self.make_low_error("struct is not supported", parser_node));
            }
        };
        let ty = match signature.specified_ty {
            Some(x) => Type::assert(body_ty, x, self.node_map).map_err(|e| self.make_error(&e, body_id))?,
            None => body_ty,
        };

        let variable_node = Node::new_variable(body_id);
        let variable_id = self.register_node(variable_node);
        self.symbol_table.set_pos(variable_id, self.calc_location(parser_node)?);
        self.symbol_table.set_ty(variable_id, ty);

        // link declaration
        self.symbol_table.set_body(decl_node_id, variable_id);
        self.symbol_table.set_ty(decl_node_id, ty);
        Ok(())
    }

    fn add_builtin_declaration(
        &mut self,
        info: BuiltinInfo,
    ) -> NodeId {
        let mut param_nodes = Vec::new();
        for param_ty in info.params {
            // make param node
            let node = Node::new_func_param("".to_owned());
            let node_id = self.register_node(node);
            self.symbol_table.set_ty(node_id, param_ty);
            param_nodes.push(node_id);
        }

        let func_node = Node::new_function(param_nodes.clone(), info.ret_ty, FunctionBody::NativeCode);
        let func_node_id = self.register_node(func_node);

        let func_signature = Signature::FunctionSignature(FunctionSignature {
            params: param_nodes,
            ret_ty: info.ret_ty,
        });
        let decl_node = Node::new_declaration(info.name.clone(), func_signature);
        let node_id = self.register_node(decl_node);
        self.symbol_table.set_ty(node_id, Type::Function);
        self.symbol_table.set_body(node_id, func_node_id);
        self.resolver.set_identifier(&info.name, node_id);
        node_id
    }

    fn add_call_main(&mut self) -> Result<NodeId, SyntaxError> {
        // declaration reference of main function
        let dest_id = match self.resolver.lookup_identifier("main") {
            Some(x) => x,
            None => return Err(SyntaxError::new("function `main` is not found")),
        };
        let callee_node = Node::new_reference(dest_id);
        let callee_id = self.register_node(callee_node);
        let dest_ty = self.get_ty_or_err(dest_id)?;
        self.symbol_table.set_ty(callee_id, dest_ty);

        // call expr
        let call_node = Node::new_call_expr(callee_id, Vec::new());
        let call_id = self.register_node(call_node);
        self.symbol_table.set_ty(call_id, Type::Void);
        Ok(call_id)
    }

    /// Generate a HIR codes from a AST.
    pub(crate) fn generate(&mut self) -> Result<Vec<NodeId>, SyntaxError> {
        let mut ids = Vec::new();

        for info in builtin::make_infos() {
            ids.push(self.add_builtin_declaration(info));
        }
        ids.extend(self.generate_statements(self.ast)?);
        ids.push(self.add_call_main()?);

        Ok(ids)
    }

    fn generate_statements(
        &mut self,
        parser_nodes: &Vec<ast::Node>,
    ) -> Result<Vec<NodeId>, SyntaxError> {
        let mut ids = Vec::new();
        for parser_node in parser_nodes.iter() {
            ids.push(self.generate_statement(parser_node)?);
        }
        Ok(ids)
    }

    /// Generate a HIR node from a statement AST node.
    /// - check if the statement is available in the global or local
    /// - check type compatibility for inner expression
    fn generate_statement(&mut self, parser_node: &ast::Node) -> Result<NodeId, SyntaxError> {
        let result = match &parser_node {
            ast::Node::FunctionDeclaration(func) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                let mut func_params = Vec::new();
                for n in func.params.iter() {
                    let param = n.as_func_param();
                    let func_param = FuncParam {
                        identifier: param.identifier.clone(),
                        // param_index: i,
                    };
                    func_params.push(func_param);
                }
                let ret_ty = match &func.ret {
                    Some(x) => Type::from_identifier(x, &self.resolver, self.node_map).map_err(|e| self.make_low_error(&e, parser_node))?, // TODO: improve error location
                    None => Type::Void,
                };

                // function declaration
                let decl_node_id = {
                    // params
                    let mut params = Vec::new();
                    for (i, func_param) in func_params.iter().enumerate() {
                        let node = Node::FuncParam(func_param.clone());
                        let node_id = self.register_node(node);
                        self.symbol_table.set_pos(node_id, self.calc_location(&func.params[i])?);
                        let param_type = match &func.params[i].as_func_param().type_identifier {
                            Some(x) => Type::from_identifier(x, &self.resolver, self.node_map).map_err(|e| self.make_error(&e, node_id))?, // TODO: improve error location
                            None => return Err(self.make_error("parameter type missing", node_id)),
                        };
                        self.symbol_table.set_ty(node_id, param_type);
                        params.push(node_id);
                    }

                    let signature = Signature::FunctionSignature(FunctionSignature {
                        params,
                        ret_ty,
                    });
                    let node = Node::new_declaration(func.identifier.clone(), signature);
                    let node_id = self.register_node(node);
                    self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                    self.symbol_table.set_ty(node_id, Type::Function);
                    self.resolver.set_identifier(&func.identifier, node_id);

                    node_id
                };

                // function
                {
                    // params
                    let mut params = Vec::new();
                    for func_param in func_params {
                        let node = Node::FuncParam(func_param);
                        let node_id = self.register_node(node);
                        params.push(node_id);
                    }

                    // body
                    self.resolver.push_frame();
                    let decl = decl_node_id.get(self.node_map).as_decl().unwrap();
                    let signature = decl.signature.as_function_signature().unwrap();
                    let mut i = 0;
                    loop {
                        let param_id = match signature.params.get(i) {
                            Some(&x) => x,
                            None => break,
                        };
                        let param = param_id.get(self.node_map).as_func_param().unwrap();
                        self.resolver.set_identifier(&param.identifier, param_id);
                        i += 1;
                    }
                    let func_body = match &func.body {
                        Some(x) => x,
                        None => return Err(self.make_low_error("function declaration cannot be undefined.", parser_node)),
                    };
                    let body = FunctionBody::Statements(self.generate_statements(func_body)?);
                    self.resolver.pop_frame();

                    let node = Node::new_function(params, ret_ty, body);
                    let func_node_id = self.register_node(node);
                    self.symbol_table.set_pos(func_node_id, self.calc_location(parser_node)?);

                    // link declaration
                    self.symbol_table.set_body(decl_node_id, func_node_id);
                }

                Ok(decl_node_id)
            }
            ast::Node::VariableDeclaration(variable) => {
                if self.trace { println!("enter statement (node: {}, identifier: {})", parser_node.get_name(), variable.identifier); }

                let has_const_attr = variable.attributes.iter().any(|x| *x == VariableAttribute::Const);
                if has_const_attr {
                    return Err(self.make_low_error("A variable with `const` is no longer supported. Use the `var` keyword instead. \nThis keyword may also be used as a constant values in the future.", parser_node));
                }
                let has_let_attr = variable.attributes.iter().any(|x| *x == VariableAttribute::Let);
                if has_let_attr {
                    return Err(self.make_low_error("A variable with `let` is no longer supported. Use the `var` keyword instead.", parser_node));
                }

                // fetch specified type
                // NOTE: The fact that type `void` cannot be explicitly declared is used to ensure that variables of type `void` are not declared.
                let specified_ty = match &variable.type_identifier {
                    Some(ident) => Some(Type::from_identifier(ident, &self.resolver, self.node_map).map_err(|e| self.make_low_error(&e, parser_node))?), // TODO: improve error location
                    None => None,
                };

                // make signature
                let signature = Signature::VariableSignature(VariableSignature {
                    specified_ty,
                });
                // make node
                let node = Node::new_declaration(variable.identifier.clone(), signature);
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                self.resolver.set_identifier(&variable.identifier, node_id);

                if let Some(var_body) = &variable.body {
                    self.define_variable_decl(parser_node, var_body, node_id)?;
                }

                Ok(node_id)
            }
            ast::Node::StructDeclaration(decl) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }

                let mut fields = Vec::new();
                for n in decl.fields.iter() {
                    let field_node = n.as_struct_decl_field();
                    let node = Node::StructDeclField(StructDeclField {
                        identifier: field_node.identifier.clone(),
                    });
                    let node_id = self.register_node(node);
                    fields.push(node_id);
                }

                // make signature
                let signature = Signature::StructSignature(StructSignature {
                    fields,
                });
                // make node
                let node = Node::new_declaration(decl.identifier.clone(), signature);
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_id, Type::Struct(node_id));
                self.resolver.set_identifier(&decl.identifier, node_id);

                Ok(node_id)
            }
            ast::Node::BreakStatement(_) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                if self.resolver.is_root_frame() {
                    return Err(self.make_low_error("A break statement cannot be used in global space", parser_node));
                }
                // TODO: check target
                let node = Node::new_break_statement();
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                Ok(node_id)
            }
            ast::Node::ReturnStatement(node) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                // TODO: consider type check
                // when global scope
                if self.resolver.is_root_frame() {
                    return Err(self.make_low_error("A return statement cannot be used in global space", parser_node));
                }
                let body = match node.body.as_ref() {
                    Some(x) => {
                        let body_id = self.generate_expr(x)?;
                        let body_ty = self.get_ty_or_err(body_id)?;
                        if body_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", body_id));
                        }
                        if body_ty == Type::Void {
                            return Err(self.make_error("A function call that does not return a value cannot be used as an expression.", body_id));
                        }
                        Some(body_id)
                    }
                    None => None,
                };
                let node = Node::new_return_statement(body);
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                Ok(node_id)
            }
            ast::Node::Assignment(statement) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                // when global scope
                if self.resolver.is_root_frame() {
                    return Err(self.make_low_error("An assignment statement cannot be used in global space", parser_node));
                }

                let reference = statement.dest.as_reference();
                let declaration_id = match self.resolver.lookup_identifier(&reference.identifier) {
                    Some(x) => x,
                    None => return Err(self.make_low_error("unknown identifier", parser_node)),
                };

                // if the declaration is not defined, define it.
                if let None = self.symbol_table.get(declaration_id).body {
                    self.define_variable_decl(parser_node, &statement.body, declaration_id)?;
                }

                // make target node
                let target_node = Node::new_reference(declaration_id);
                let target_id = self.register_node(target_node);
                self.symbol_table.set_pos(target_id, self.calc_location(parser_node)?);
                let declaration_ty = self.get_ty_or_low_err(declaration_id, parser_node)?;
                self.symbol_table.set_ty(target_id, declaration_ty);

                let expr_id = self.generate_expr(&statement.body)?;

                match statement.mode {
                    AssignmentMode::Assign => {
                        let target_ty = self.get_ty_or_err(target_id)?;
                        if target_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", target_id));
                        }
                        let expr_ty = self.get_ty_or_err(expr_id)?;
                        if expr_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", expr_id));
                        }
                        if expr_ty == Type::Void {
                            return Err(self.make_error("A function call that does not return a value cannot be used as an expression.", expr_id));
                        }
                        Type::assert(expr_ty, target_ty, self.node_map).map_err(|e| self.make_low_error(&e, parser_node))?;
                    }
                    AssignmentMode::AddAssign
                    | AssignmentMode::SubAssign
                    | AssignmentMode::MultAssign
                    | AssignmentMode::DivAssign
                    | AssignmentMode::ModAssign => {
                        let target_ty = self.get_ty_or_low_err(target_id, parser_node)?;
                        Type::assert(target_ty, Type::Number, self.node_map).map_err(|e| self.make_error(&e, target_id))?; // TODO: improve error message
                        let expr_ty = self.get_ty_or_err(expr_id)?;
                        Type::assert(expr_ty, Type::Number, self.node_map).map_err(|e| self.make_error(&e, expr_id))?;
                    }
                }

                // make node
                let node = Node::new_assignment(target_id, expr_id, statement.mode);
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                Ok(node_id)
            }
            ast::Node::IfStatement(if_statement) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                fn transform(
                    index: usize,
                    analyzer: &mut HirGenerator,
                    parser_node: &ast::Node,
                    items: &Vec<(Box<ast::Node>, Vec<ast::Node>)>,
                    else_block: &Option<Vec<ast::Node>>,
                ) -> Result<Option<NodeId>, SyntaxError> {
                    match items.get(index) {
                        Some((cond, then_block)) => {
                            let cond_id = analyzer.generate_expr(cond)?;
                            let cond_ty = analyzer.get_ty_or_err(cond_id)?;
                            Type::assert(cond_ty, Type::Bool, analyzer.node_map).map_err(|e| analyzer.make_error(&e, cond_id))?;
                            let then_nodes = analyzer.generate_statements(then_block)?;
                            // next else if part
                            let elif = transform(index + 1, analyzer, parser_node, items, else_block)?;
                            match elif {
                                Some(x) => {
                                    let node = Node::new_if_statement(cond_id, then_nodes, vec![x]);
                                    let node_id = analyzer.register_node(node);
                                    analyzer.symbol_table.set_pos(node_id, analyzer.calc_location(parser_node)?);
                                    Ok(Some(node_id))
                                }
                                None => {
                                    let else_nodes = match &else_block {
                                        Some(x) => analyzer.generate_statements(x)?,
                                        None => vec![],
                                    };
                                    let node = Node::new_if_statement(cond_id, then_nodes, else_nodes);
                                    let node_id = analyzer.register_node(node);
                                    analyzer.symbol_table.set_pos(node_id, analyzer.calc_location(parser_node)?);
                                    Ok(Some(node_id))
                                }
                            }
                        }
                        None => Ok(None),
                    }
                }
                // desugar and make node
                let node_id = match transform(
                    0,
                    self,
                    parser_node,
                    &if_statement.cond_blocks,
                    &if_statement.else_block,
                )? {
                    Some(x) => x,
                    None => panic!("unexpected error: cond blocks is empty"),
                };
                Ok(node_id)
            }
            ast::Node::LoopStatement(statement) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                if self.resolver.is_root_frame() {
                    return Err(self.make_low_error("A loop statement cannot be used in global space", parser_node));
                }
                let body = self.generate_statements(&statement.body)?;
                let node = Node::new_loop_statement(body);
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                Ok(node_id)
            }
            ast::Node::Reference(_)
            | ast::Node::NumberLiteral(_)
            | ast::Node::BoolLiteral(_)
            | ast::Node::StringLiteral(_)
            | ast::Node::BinaryExpr(_)
            | ast::Node::UnaryOp(_)
            | ast::Node::CallExpr(_)
            | ast::Node::StructExpr(_) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                // when global scope
                if self.resolver.is_root_frame() {
                    return Err(self.make_low_error("An expression cannot be used in global space", parser_node));
                }
                let expr_id = self.generate_expr(parser_node)?;
                let expr_ty = self.get_ty_or_err(expr_id)?;
                if expr_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", expr_id));
                }
                Ok(expr_id)
            }
            ast::Node::FuncParam(_)
            | ast::Node::StructDeclField(_)
            | ast::Node::StructExprField(_) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                panic!("unexpected node");
            }
        };
        if self.trace { println!("leave statement (node: {})", parser_node.get_name()); }
        result
    }

    /// Generate a HIR node from a expression AST node.
    /// - infer type for the expression
    /// - check type compatibility for inner expression
    /// - generate syntax errors
    fn generate_expr(&mut self, parser_node: &ast::Node) -> Result<NodeId, SyntaxError> {
        let result = match parser_node {
            ast::Node::Reference(reference) => {
                if self.trace { println!("enter expr (node: {}, identifier: {})", parser_node.get_name(), reference.identifier); }
                let dest_id = match self.resolver.lookup_identifier(&reference.identifier) {
                    Some(x) => x,
                    None => return Err(self.make_low_error("unknown identifier", parser_node)),
                };

                let node = Node::new_reference(dest_id);
                let node_id = self.register_node(node);
                let dest_ty = self.get_ty_or_low_err(dest_id, parser_node)?;
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_id, dest_ty);
                Ok(node_id)
            }
            ast::Node::NumberLiteral(node) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let node = Node::new_literal(LiteralValue::Number(node.value));
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_id, Type::Number);
                Ok(node_id)
            }
            ast::Node::BoolLiteral(node) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let node = Node::new_literal(LiteralValue::Bool(node.value));
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_id, Type::Bool);
                Ok(node_id)
            }
            ast::Node::StringLiteral(node) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let node = Node::new_literal(LiteralValue::String(node.value.clone()));
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_id, Type::String);
                Ok(node_id)
            }
            ast::Node::UnaryOp(unary_op) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let expr_id = self.generate_expr(&unary_op.expr)?;
                let expr_ty = self.get_ty_or_err(expr_id)?;
                if expr_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", expr_id));
                }
                if expr_ty == Type::Void {
                    return Err(self.make_error("A function call that does not return a value cannot be used as an expression.", expr_id));
                }
                let op_str = unary_op.operator.as_str();
                let op = match op_str {
                    "!" => LogicalUnaryOperator::Not,
                    _ => return Err(self.make_low_error("unexpected operation", parser_node)),
                };
                Type::assert(expr_ty, Type::Bool, self.node_map).map_err(|e| self.make_error(&e, expr_id))?;
                let node = Node::new_logical_unary_op(op, expr_id);
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_id, Type::Bool);
                Ok(node_id)
            }
            ast::Node::BinaryExpr(binary_expr) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let left_id = self.generate_expr(&binary_expr.left)?;
                let right_id = self.generate_expr(&binary_expr.right)?;
                let left_ty = self.get_ty_or_err(left_id)?;
                let right_ty = self.get_ty_or_err(right_id)?;
                if left_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", left_id));
                }
                if left_ty == Type::Void {
                    return Err(self.make_error("A function call that does not return a value cannot be used as an expression.", left_id));
                }
                if right_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", right_id));
                }
                if right_ty == Type::Void {
                    return Err(self.make_error("A function call that does not return a value cannot be used as an expression.", right_id));
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
                        Type::assert(left_ty, Type::Number, self.node_map).map_err(|e| self.make_error(&e, left_id))?;
                        Type::assert(right_ty, Type::Number, self.node_map).map_err(|e| self.make_error(&e, right_id))?;
                        let node = Node::new_arithmetic_op(op, left_id, right_id);
                        let node_id = self.register_node(node);
                        self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                        self.symbol_table.set_ty(node_id, Type::Number);
                        return Ok(node_id);
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
                        Type::assert(right_ty, left_ty, self.node_map).map_err(|e| self.make_low_error(&e, parser_node))?; // TODO: improve error message
                        let node = Node::new_relational_op(op, left_ty, left_id, right_id);
                        let node_id = self.register_node(node);
                        self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                        self.symbol_table.set_ty(node_id, Type::Bool);
                        return Ok(node_id);
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
                        Type::assert(left_ty, Type::Bool, self.node_map).map_err(|e| self.make_error(&e, left_id))?;
                        Type::assert(right_ty, Type::Bool, self.node_map).map_err(|e| self.make_error(&e, right_id))?;
                        let node = Node::new_logical_binary_op(op, left_id, right_id);
                        let node_id = self.register_node(node);
                        self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                        self.symbol_table.set_ty(node_id, Type::Bool);
                        return Ok(node_id);
                    }
                }
                Err(self.make_low_error("unexpected operation", parser_node))
            }
            ast::Node::CallExpr(call_expr) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let callee_id = self.generate_expr(&call_expr.callee)?;
                let callee_func_id = self.resolve_node(callee_id);
                let callee_func = callee_func_id.get(self.node_map).as_decl().map_err(|e| self.make_error(&e, callee_id))?;
                let signature = callee_func.signature.as_function_signature().map_err(|e| self.make_error(&e, callee_id))?;
                let ret_ty = signature.ret_ty;
                let params = signature.params.clone();
                if params.len() != call_expr.args.len() {
                    return Err(self.make_low_error("argument count incorrect", parser_node));
                }
                let mut args = Vec::new();
                for (i, &param_id) in params.iter().enumerate() {
                    let arg_id = self.generate_expr(&call_expr.args[i])?;
                    let param_ty = self.get_ty_or_err(param_id)?;
                    let arg_ty = self.get_ty_or_err(arg_id)?;
                    if param_ty == Type::Function {
                        return Err(self.make_error("type `function` is not supported", param_id));
                    }
                    if arg_ty == Type::Function {
                        return Err(self.make_error("type `function` is not supported", arg_id));
                    }
                    if arg_ty == Type::Void {
                        return Err(self.make_error("A function call that does not return a value cannot be used as an expression.", arg_id));
                    }
                    Type::assert(arg_ty, param_ty, self.node_map).map_err(|e| self.make_error(&e, arg_id))?;
                    args.push(arg_id);
                }
                let node = Node::new_call_expr(callee_id, args);
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_id, ret_ty);
                Ok(node_id)
            }
            ast::Node::StructExpr(struct_expr) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }

                let ty = Type::from_identifier(&struct_expr.identifier, &self.resolver, self.node_map).map_err(|e| self.make_low_error(&e, parser_node))?;

                // TODO: type check for fields

                let mut fields = Vec::new();
                for n in struct_expr.fields.iter() {
                    let field_node = n.as_struct_expr_field();
                    let field_body_id = self.generate_expr(&field_node.body)?;
                    let node = Node::new_struct_expr_field(field_node.identifier.clone(), field_body_id);
                    let node_id = self.register_node(node);
                    fields.push(node_id);
                }

                // make node
                let node = Node::new_struct_expr(struct_expr.identifier.clone(), fields);
                let node_id = self.register_node(node);
                self.symbol_table.set_pos(node_id, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_id, ty);

                Ok(node_id)
            }
            ast::Node::FunctionDeclaration(_)
            | ast::Node::VariableDeclaration(_)
            | ast::Node::StructDeclaration(_)
            | ast::Node::BreakStatement(_)
            | ast::Node::ReturnStatement(_)
            | ast::Node::Assignment(_)
            | ast::Node::IfStatement(_)
            | ast::Node::LoopStatement(_)
            | ast::Node::FuncParam(_)
            | ast::Node::StructDeclField(_)
            | ast::Node::StructExprField(_) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                panic!("unexpected expr node");
            }
        };
        if self.trace { println!("leave expr (node: {})", parser_node.get_name()); }
        result
    }
}

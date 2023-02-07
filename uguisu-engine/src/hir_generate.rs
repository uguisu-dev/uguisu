use std::collections::HashMap;
use crate::SyntaxError;
use crate::ast::{
    self,
    AssignmentMode,
    VariableAttribute,
};
use crate::hir::{
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
    ResolverStack,
    ReturnStatement,
    Signature,
    SymbolTable,
    Variable,
    VariableSignature, Type,
};

pub(crate) struct Analyzer<'a> {
    input: &'a str,
    source: &'a mut HashMap<hir::NodeId, hir::Node>,
    symbol_table: &'a mut SymbolTable,
    resolver: ResolverStack,
    trace: bool,
}

impl<'a> Analyzer<'a> {
    pub(crate) fn new(
        input: &'a str,
        source: &'a mut HashMap<hir::NodeId, hir::Node>,
        symbol_table: &'a mut SymbolTable,
        trace: bool,
    ) -> Self {
        Self {
            input,
            source,
            symbol_table,
            resolver: ResolverStack::new(trace),
            trace,
        }
    }

    fn register_node(&mut self, node: hir::Node) -> hir::NodeRef {
        let node_id = self.source.len();
        if self.trace { println!("new node: {} [{}]", node.get_name(), node_id); }
        self.source.insert(node_id, node);
        let node_ref = hir::NodeRef::new(node_id);
        self.symbol_table.new_record(node_ref);
        node_ref
    }

    fn calc_location(&self, node: &ast::Node) -> Result<(usize, usize), SyntaxError> {
        node.calc_location(self.input).map_err(|e| SyntaxError::new(&e))
    }

    fn make_low_error(&self, message: &str, node: &ast::Node) -> SyntaxError {
        let (line, column) = node.calc_location(self.input).unwrap();
        SyntaxError::new(&format!("{} ({}:{})", message, line, column))
    }

    fn make_error(&self, message: &str, node: hir::NodeRef) -> SyntaxError {
        match self.symbol_table.get(node).pos {
            Some((line, column)) => SyntaxError::new(&format!("{} ({}:{})", message, line, column)),
            None => SyntaxError::new(&format!("{}", message)),
        }
    }

    fn resolve_node(&self, node_ref: hir::NodeRef) -> hir::NodeRef {
        match node_ref.get(self.source) {
            hir::Node::Reference(reference) => self.resolve_node(reference.dest),
            _ => node_ref,
        }
    }

    fn define_variable_decl(&mut self, parser_node: &ast::Node, body: &ast::Node, decl_node_ref: hir::NodeRef) -> Result<(), SyntaxError> {
        let body_ref = self.generate_expr(body)?;
        let body_ty = self.symbol_table.get(body_ref).ty.map_or(Err(self.make_error("type not resolved", body_ref)), |x| Ok(x))?;
        if body_ty == Type::Function {
            return Err(self.make_error("type `function` is not supported", body_ref));
        }
        let decl_node = decl_node_ref.get(self.source);
        let decl = decl_node.as_decl().unwrap();
        let signature = match &decl.signature {
            Signature::VariableSignature(x) => x,
            Signature::FunctionSignature(_) => {
                return Err(self.make_low_error("type `function` is not supported", parser_node));
            }
        };
        let ty = match signature.specified_ty {
            Some(x) => Type::assert(body_ty, x).map_err(|e| self.make_error(&e, body_ref))?,
            None => body_ty,
        };

        let variable_node = hir::Node::Variable(Variable {
            content: body_ref,
        });
        let variable_ref = self.register_node(variable_node);
        self.symbol_table.set_pos(variable_ref, self.calc_location(parser_node)?);
        self.symbol_table.set_ty(variable_ref, ty);

        // link declaration
        self.symbol_table.set_body(decl_node_ref, variable_ref);
        self.symbol_table.set_ty(decl_node_ref, ty);
        Ok(())
    }

    fn register_builtin(
        &mut self,
        name: &str,
        params: Vec<(&str, Type)>,
        ret_ty: Type,
    ) -> hir::NodeRef {
        let mut param_nodes = Vec::new();
        for &(param_name, param_ty) in params.iter() {
            // make param node
            let node = hir::Node::FuncParam(FuncParam {
                identifier: String::from(param_name),
                // param_index: i,
            });
            let node_ref = self.register_node(node);
            self.symbol_table.set_ty(node_ref, param_ty);
            param_nodes.push(node_ref);
        }

        let func_node = hir::Node::Function(Function {
            params: param_nodes.clone(),
            ret_ty,
            content: FunctionBody::NativeCode,
        });
        let func_node_ref = self.register_node(func_node);

        let signature = Signature::FunctionSignature(FunctionSignature {
            params: param_nodes,
            ret_ty,
        });
        let decl_node = hir::Node::Declaration(Declaration {
            identifier: String::from(name),
            signature,
        });
        let node_ref = self.register_node(decl_node);
        self.symbol_table.set_ty(node_ref, Type::Function);
        self.symbol_table.set_body(node_ref, func_node_ref);
        self.resolver.set_identifier(name, node_ref);
        node_ref
    }

    fn add_call_main(&mut self) -> Result<hir::NodeRef, SyntaxError> {
        // declaration reference of main function
        let dest_ref = match self.resolver.lookup_identifier("main") {
            Some(x) => x,
            None => return Err(SyntaxError::new("function `main` is not found")),
        };
        let callee_node = hir::Node::Reference(Reference {
            dest: dest_ref,
        });
        let callee_ref = self.register_node(callee_node);
        let dest_ty = self.symbol_table.get(dest_ref).ty.map_or(Err(SyntaxError::new("type not resolved")), |x| Ok(x))?;
        self.symbol_table.set_ty(callee_ref, dest_ty);

        // call expr
        let call_node = hir::Node::CallExpr(CallExpr {
            callee: callee_ref,
            args: Vec::new(),
        });
        let call_ref = self.register_node(call_node);
        self.symbol_table.set_ty(call_ref, Type::Void);
        Ok(call_ref)
    }

    /// Generate a HIR codes from a AST.
    pub(crate) fn generate(&mut self, ast: &Vec<ast::Node>) -> Result<Vec<hir::NodeRef>, SyntaxError> {
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

        ids.extend(self.generate_statements(ast)?);
        ids.push(self.add_call_main()?);

        Ok(ids)
    }

    fn generate_statements(
        &mut self,
        parser_nodes: &Vec<ast::Node>,
    ) -> Result<Vec<hir::NodeRef>, SyntaxError> {
        let mut ids = Vec::new();
        for parser_node in parser_nodes.iter() {
            ids.push(self.generate_statement(parser_node)?);
        }
        Ok(ids)
    }

    /// Generate a HIR node from a statement AST node.
    /// - check if the statement is available in the global or local
    /// - check type compatibility for inner expression
    fn generate_statement(&mut self, parser_node: &ast::Node) -> Result<hir::NodeRef, SyntaxError> {
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
                    Some(x) => Type::from_identifier(x).map_err(|e| self.make_low_error(&e, parser_node))?, // TODO: improve error location
                    None => Type::Void,
                };

                // function declaration
                let decl_node_ref = {
                    // params
                    let mut params = Vec::new();
                    for (i, func_param) in func_params.iter().enumerate() {
                        let node = hir::Node::FuncParam(func_param.clone());
                        let node_ref = self.register_node(node);
                        self.symbol_table.set_pos(node_ref, self.calc_location(&func.params[i])?);
                        let param_type = match &func.params[i].as_func_param().type_identifier {
                            Some(x) => Type::from_identifier(x).map_err(|e| self.make_error(&e, node_ref))?, // TODO: improve error location
                            None => return Err(self.make_error("parameter type missing", node_ref)),
                        };
                        self.symbol_table.set_ty(node_ref, param_type);
                        params.push(node_ref);
                    }

                    let signature = Signature::FunctionSignature(FunctionSignature {
                        params,
                        ret_ty,
                    });
                    let node = hir::Node::Declaration(Declaration {
                        identifier: func.identifier.clone(),
                        signature,
                    });
                    let node_ref = self.register_node(node);
                    self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                    self.symbol_table.set_ty(node_ref, Type::Function);
                    self.resolver.set_identifier(&func.identifier, node_ref);

                    node_ref
                };

                // function
                {
                    // params
                    let mut params = Vec::new();
                    for func_param in func_params {
                        let node = hir::Node::FuncParam(func_param);
                        let node_ref = self.register_node(node);
                        params.push(node_ref);
                    }

                    // body
                    self.resolver.push_frame();
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
                        self.resolver.set_identifier(&param.identifier, param_ref);
                        i += 1;
                    }
                    let func_body = match &func.body {
                        Some(x) => x,
                        None => return Err(self.make_low_error("function declaration cannot be undefined.", parser_node)),
                    };
                    let body = FunctionBody::Statements(self.generate_statements(func_body)?);
                    self.resolver.pop_frame();

                    let node = hir::Node::Function(Function {
                        params,
                        ret_ty,
                        content: body,
                    });
                    let func_node_ref = self.register_node(node);
                    self.symbol_table.set_pos(func_node_ref, self.calc_location(parser_node)?);

                    // link declaration
                    self.symbol_table.set_body(decl_node_ref, func_node_ref);
                }

                Ok(decl_node_ref)
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
                    Some(ident) => Some(Type::from_identifier(ident).map_err(|e| self.make_low_error(&e, parser_node))?), // TODO: improve error location
                    None => None,
                };

                // make signature
                let signature = Signature::VariableSignature(VariableSignature {
                    specified_ty,
                });
                // make node
                let node = hir::Node::Declaration(Declaration {
                    identifier: variable.identifier.clone(),
                    signature,
                });
                let node_ref = self.register_node(node);
                self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                self.resolver.set_identifier(&variable.identifier, node_ref);

                if let Some(var_body) = &variable.body {
                    self.define_variable_decl(parser_node, var_body, node_ref)?;
                }

                Ok(node_ref)
            }
            ast::Node::BreakStatement(_) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                if self.resolver.is_root_frame() {
                    return Err(self.make_low_error("A break statement cannot be used in global space", parser_node));
                }
                // TODO: check target
                let node = hir::Node::BreakStatement(BreakStatement {});
                let node_ref = self.register_node(node);
                self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                Ok(node_ref)
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
                        let body_ref = self.generate_expr(x)?;
                        let body_ty = self.symbol_table.get(body_ref).ty.map_or(Err(self.make_error("type not resolved", body_ref)), |x| Ok(x))?;
                        if body_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", body_ref));
                        }
                        Some(body_ref)
                    }
                    None => None,
                };
                let node = hir::Node::ReturnStatement(ReturnStatement {
                    body,
                });
                let node_ref = self.register_node(node);
                self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                Ok(node_ref)
            }
            ast::Node::Assignment(statement) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                // when global scope
                if self.resolver.is_root_frame() {
                    return Err(self.make_low_error("An assignment statement cannot be used in global space", parser_node));
                }

                let reference = statement.dest.as_reference();
                let declaration_ref = match self.resolver.lookup_identifier(&reference.identifier) {
                    Some(x) => x,
                    None => return Err(self.make_low_error("unknown identifier", parser_node)),
                };

                // if the declaration is not defined, define it.
                if let None = self.symbol_table.get(declaration_ref).body {
                    self.define_variable_decl(parser_node, &statement.body, declaration_ref)?;
                }

                // make target node
                let target_node = hir::Node::Reference(Reference {
                    dest: declaration_ref,
                });
                let target_ref = self.register_node(target_node);
                self.symbol_table.set_pos(target_ref, self.calc_location(parser_node)?);
                let declaration_ty = self.symbol_table.get(declaration_ref).ty.map_or(Err(self.make_low_error("type not resolved", parser_node)), |x| Ok(x))?;
                self.symbol_table.set_ty(target_ref, declaration_ty);

                let expr_ref = self.generate_expr(&statement.body)?;

                match statement.mode {
                    AssignmentMode::Assign => {
                        let target_ty = self.symbol_table.get(target_ref).ty.map_or(Err(self.make_error("type not resolved", target_ref)), |x| Ok(x))?;
                        if target_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", target_ref));
                        }
                        let expr_ty = self.symbol_table.get(expr_ref).ty.map_or(Err(self.make_error("type not resolved", expr_ref)), |x| Ok(x))?;
                        if expr_ty == Type::Function {
                            return Err(self.make_error("type `function` is not supported", expr_ref));
                        }
                        Type::assert(expr_ty, target_ty).map_err(|e| self.make_low_error(&e, parser_node))?;
                    }
                    AssignmentMode::AddAssign
                    | AssignmentMode::SubAssign
                    | AssignmentMode::MultAssign
                    | AssignmentMode::DivAssign
                    | AssignmentMode::ModAssign => {
                        let target_ty = self.symbol_table.get(target_ref).ty.map_or(Err(self.make_low_error("type not resolved", parser_node)), |x| Ok(x))?;
                        Type::assert(target_ty, Type::Number).map_err(|e| self.make_error(&e, target_ref))?; // TODO: improve error message
                        let expr_ty = self.symbol_table.get(expr_ref).ty.map_or(Err(self.make_error("type not resolved", expr_ref)), |x| Ok(x))?;
                        Type::assert(expr_ty, Type::Number).map_err(|e| self.make_error(&e, expr_ref))?;
                    }
                }

                // make node
                let node = hir::Node::Assignment(Assignment {
                    dest: target_ref,
                    body: expr_ref,
                    mode: statement.mode,
                });
                let node_ref = self.register_node(node);
                self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                Ok(node_ref)
            }
            ast::Node::IfStatement(if_statement) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                fn transform(
                    index: usize,
                    analyzer: &mut Analyzer,
                    parser_node: &ast::Node,
                    items: &Vec<(Box<ast::Node>, Vec<ast::Node>)>,
                    else_block: &Option<Vec<ast::Node>>,
                ) -> Result<Option<hir::NodeRef>, SyntaxError> {
                    match items.get(index) {
                        Some((cond, then_block)) => {
                            let cond_ref = analyzer.generate_expr(cond)?;
                            let cond_ty = analyzer.symbol_table.get(cond_ref).ty.map_or(Err(analyzer.make_error("type not resolved", cond_ref)), |x| Ok(x))?;
                            Type::assert(cond_ty, Type::Bool).map_err(|e| analyzer.make_error(&e, cond_ref))?;
                            let then_nodes = analyzer.generate_statements(then_block)?;
                            // next else if part
                            let elif = transform(index + 1, analyzer, parser_node, items, else_block)?;
                            match elif {
                                Some(x) => {
                                    let node = hir::Node::IfStatement(IfStatement {
                                        condition: cond_ref,
                                        then_block: then_nodes,
                                        else_block: vec![x],
                                    });
                                    let node_ref = analyzer.register_node(node);
                                    analyzer.symbol_table.set_pos(node_ref, analyzer.calc_location(parser_node)?);
                                    Ok(Some(node_ref))
                                }
                                None => {
                                    let else_nodes = match &else_block {
                                        Some(x) => analyzer.generate_statements(x)?,
                                        None => vec![],
                                    };
                                    let node = hir::Node::IfStatement(IfStatement {
                                        condition: cond_ref,
                                        then_block: then_nodes,
                                        else_block: else_nodes,
                                    });
                                    let node_ref = analyzer.register_node(node);
                                    analyzer.symbol_table.set_pos(node_ref, analyzer.calc_location(parser_node)?);
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
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                if self.resolver.is_root_frame() {
                    return Err(self.make_low_error("A loop statement cannot be used in global space", parser_node));
                }
                let body = self.generate_statements(&statement.body)?;
                let node = hir::Node::LoopStatement(LoopStatement {
                    body,
                });
                let node_ref = self.register_node(node);
                self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                Ok(node_ref)
            }
            ast::Node::Reference(_)
            | ast::Node::NumberLiteral(_)
            | ast::Node::BoolLiteral(_)
            | ast::Node::BinaryExpr(_)
            | ast::Node::UnaryOp(_)
            | ast::Node::CallExpr(_) => {
                if self.trace { println!("enter statement (node: {})", parser_node.get_name()); }
                // when global scope
                if self.resolver.is_root_frame() {
                    return Err(self.make_low_error("An expression cannot be used in global space", parser_node));
                }
                let expr_ref = self.generate_expr(parser_node)?;
                let expr_ty = self.symbol_table.get(expr_ref).ty.map_or(Err(self.make_error("type not resolved", expr_ref)), |x| Ok(x))?;
                if expr_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", expr_ref));
                }
                Ok(expr_ref)
            }
            ast::Node::FuncParam(_) => {
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
    fn generate_expr(&mut self, parser_node: &ast::Node) -> Result<hir::NodeRef, SyntaxError> {
        let result = match parser_node {
            ast::Node::Reference(reference) => {
                if self.trace { println!("enter expr (node: {}, identifier: {})", parser_node.get_name(), reference.identifier); }
                let dest_ref = match self.resolver.lookup_identifier(&reference.identifier) {
                    Some(x) => x,
                    None => return Err(self.make_low_error("unknown identifier", parser_node)),
                };

                let node = hir::Node::Reference(Reference {
                    dest: dest_ref,
                });
                let node_ref = self.register_node(node);
                let dest_ty = self.symbol_table.get(dest_ref).ty.map_or(Err(self.make_low_error("type not resolved", parser_node)), |x| Ok(x))?;
                self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_ref, dest_ty);
                Ok(node_ref)
            }
            ast::Node::NumberLiteral(node) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let node = hir::Node::Literal(Literal {
                    value: LiteralValue::Number(node.value),
                });
                let node_ref = self.register_node(node);
                self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_ref, Type::Number);
                Ok(node_ref)
            }
            ast::Node::BoolLiteral(node) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let node = hir::Node::Literal(Literal {
                    value: LiteralValue::Bool(node.value),
                });
                let node_ref = self.register_node(node);
                self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_ref, Type::Bool);
                Ok(node_ref)
            }
            ast::Node::UnaryOp(unary_op) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let expr_ref = self.generate_expr(&unary_op.expr)?;
                let expr_ty = self.symbol_table.get(expr_ref).ty.map_or(Err(self.make_error("type not resolved", expr_ref)), |x| Ok(x))?;
                if expr_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", expr_ref));
                }
                let op_str = unary_op.operator.as_str();
                let op = match op_str {
                    "!" => LogicalUnaryOperator::Not,
                    _ => return Err(self.make_low_error("unexpected operation", parser_node)),
                };
                Type::assert(expr_ty, Type::Bool).map_err(|e| self.make_error(&e, expr_ref))?;
                let node = hir::Node::LogicalUnaryOp(LogicalUnaryOp {
                    operator: op,
                    expr: expr_ref,
                });
                let node_ref = self.register_node(node);
                self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_ref, Type::Bool);
                Ok(node_ref)
            }
            ast::Node::BinaryExpr(binary_expr) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let left_ref = self.generate_expr(&binary_expr.left)?;
                let right_ref = self.generate_expr(&binary_expr.right)?;
                let left_ty = self.symbol_table.get(left_ref).ty.map_or(Err(self.make_error("type not resolved", left_ref)), |x| Ok(x))?;
                let right_ty = self.symbol_table.get(right_ref).ty.map_or(Err(self.make_error("type not resolved", right_ref)), |x| Ok(x))?;
                if left_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", left_ref));
                }
                if right_ty == Type::Function {
                    return Err(self.make_error("type `function` is not supported", right_ref));
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
                        Type::assert(left_ty, Type::Number).map_err(|e| self.make_error(&e, left_ref))?;
                        Type::assert(right_ty, Type::Number).map_err(|e| self.make_error(&e, right_ref))?;
                        let node = hir::Node::ArithmeticOp(ArithmeticOp {
                            operator: op,
                            left: left_ref,
                            right: right_ref,
                        });
                        let node_ref = self.register_node(node);
                        self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                        self.symbol_table.set_ty(node_ref, Type::Number);
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
                        let node = hir::Node::RelationalOp(RelationalOp {
                            operator: op,
                            relation_type: left_ty,
                            left: left_ref,
                            right: right_ref,
                        });
                        let node_ref = self.register_node(node);
                        self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                        self.symbol_table.set_ty(node_ref, Type::Bool);
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
                        Type::assert(left_ty, Type::Bool).map_err(|e| self.make_error(&e, left_ref))?;
                        Type::assert(right_ty, Type::Bool).map_err(|e| self.make_error(&e, right_ref))?;
                        let node = hir::Node::LogicalBinaryOp(LogicalBinaryOp {
                            operator: op,
                            left: left_ref,
                            right: right_ref,
                        });
                        let node_ref = self.register_node(node);
                        self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                        self.symbol_table.set_ty(node_ref, Type::Bool);
                        return Ok(node_ref);
                    }
                }
                Err(self.make_low_error("unexpected operation", parser_node))
            }
            ast::Node::CallExpr(call_expr) => {
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                let callee_ref = self.generate_expr(&call_expr.callee)?;
                let callee_func_ref = self.resolve_node(callee_ref);
                let callee_func_node = callee_func_ref.get(self.source);
                let callee_func = callee_func_node.as_decl().map_err(|e| self.make_error(&e, callee_ref))?;
                let signature = callee_func.signature.as_function_signature().map_err(|e| self.make_error(&e, callee_ref))?;
                let ret_ty = signature.ret_ty;
                let params = signature.params.clone();
                if params.len() != call_expr.args.len() {
                    return Err(self.make_low_error("argument count incorrect", parser_node));
                }
                let mut args = Vec::new();
                for (i, &param_ref) in params.iter().enumerate() {
                    let arg_ref = self.generate_expr(&call_expr.args[i])?;
                    let param_ty = self.symbol_table.get(param_ref).ty.map_or(Err(self.make_error("type not resolved", param_ref)), |x| Ok(x))?;
                    let arg_ty = self.symbol_table.get(arg_ref).ty.map_or(Err(self.make_error("type not resolved", arg_ref)), |x| Ok(x))?;
                    if param_ty == Type::Function {
                        return Err(self.make_error("type `function` is not supported", param_ref));
                    }
                    if arg_ty == Type::Function {
                        return Err(self.make_error("type `function` is not supported", arg_ref));
                    }
                    Type::assert(arg_ty, param_ty).map_err(|e| self.make_error(&e, arg_ref))?;
                    args.push(arg_ref);
                }
                let node = hir::Node::CallExpr(CallExpr {
                    callee: callee_ref,
                    args,
                });
                let node_ref = self.register_node(node);
                self.symbol_table.set_pos(node_ref, self.calc_location(parser_node)?);
                self.symbol_table.set_ty(node_ref, ret_ty);
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
                if self.trace { println!("enter expr (node: {})", parser_node.get_name()); }
                panic!("unexpected expr node");
            }
        };
        if self.trace { println!("leave expr (node: {})", parser_node.get_name()); }
        result
    }
}
use crate::parse;
use crate::parse::NodeRef;
use crate::CompileError;

#[derive(Debug, PartialEq, Clone)]
pub enum Type {
    Number,
}

#[derive(Debug, PartialEq, Clone)]
pub struct Function {
    pub name: String,
    pub param_name_vec: Vec<String>, // for each params
    pub param_ty_vec: Vec<Type>,     // for each params
    pub ret_ty: Option<Type>,
    pub codegen_id: Option<u32>,
    pub is_external: bool,
}

#[derive(Debug, PartialEq, Clone)]
pub struct Variable {
    pub name: String,
    pub ty: Type,
    pub is_mutable: bool,
}

pub type SymbolId = usize;

#[derive(Debug, PartialEq, Clone)]
pub enum Symbol {
    Function(Function),
    Variable(Variable),
}

#[derive(Debug, PartialEq, Clone)]
pub struct ScopeLayer {
    symbols: Vec<SymbolId>,
}

impl ScopeLayer {
    pub fn new() -> Self {
        Self {
            symbols: Vec::new(),
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

    pub fn add_symbol(&mut self, symbol: SymbolId) {
        match self.layers.get_mut(0) {
            Some(layer) => {
                layer.symbols.push(symbol);
            }
            None => panic!(),
        }
    }
}

pub struct Resolver<'a> {
    symbols: &'a mut Vec<Symbol>,
    scope: &'a mut Scope,
}

impl<'a> Resolver<'a> {
    pub fn new(symbols: &'a mut Vec<Symbol>, scope: &'a mut Scope) -> Self {
        Self { symbols, scope }
    }

    fn resolve_with_scope(&self, identifier: &str) -> Option<SymbolId> {
        for layer in self.scope.layers.iter() {
            for symbol_id in layer.symbols.iter() {
                match &self.symbols[*symbol_id] {
                    Symbol::Function(func) => {
                        if func.name == identifier {
                            return Some(*symbol_id);
                        }
                    }
                    Symbol::Variable(var) => {
                        if var.name == identifier {
                            return Some(*symbol_id);
                        }
                    }
                }
            }
        }
        None
    }

    pub fn resolve(&mut self, ast: &mut Vec<parse::Node>) -> Result<(), CompileError> {
        for statement in ast.iter() {
            match statement {
                parse::Node::FunctionDeclaration(func_decl) => {
                    self.function_declaration(func_decl)?;
                }
                _ => {}
            }
        }
        for statement in ast.iter_mut() {
            match statement {
                parse::Node::FunctionDeclaration(func_decl) => {
                    self.function_body(func_decl)?;
                }
                _ => {}
            }
        }
        Ok(())
    }

    fn function_declaration(
        &mut self,
        node: &parse::FunctionDeclaration,
    ) -> Result<(), CompileError> {
        let mut param_name_vec = Vec::new();
        let mut param_ty_vec = Vec::new();
        for param in node.params.iter() {
            let param_ty = match &param.type_identifier {
                Some(type_name) => {
                    // TODO: support other types
                    if type_name != "number" {
                        return Err(CompileError::new("unknown type"));
                    }
                    Type::Number
                }
                None => return Err(CompileError::new("Parameter type is not specified.")),
            };
            param_name_vec.push(param.identifier.clone());
            param_ty_vec.push(param_ty);
        }
        let ret_ty = match &node.ret {
            Some(type_name) => {
                // TODO: support other types
                if type_name != "number" {
                    return Err(CompileError::new("unknown type"));
                }
                Some(Type::Number)
            }
            None => None,
        };
        let func = Function {
            name: node.identifier.clone(),
            param_name_vec,
            param_ty_vec,
            ret_ty,
            is_external: false,
            codegen_id: None,
        };
        self.symbols.push(Symbol::Function(func));
        let symbol_id = self.symbols.len() - 1;
        self.scope.add_symbol(symbol_id);
        Ok(())
    }

    fn function_body(&mut self, node: &mut parse::FunctionDeclaration) -> Result<(), CompileError> {
        if let Some(body) = &mut node.body {
            self.scope.enter_scope();
            let func = match self.resolve_with_scope(&node.identifier) {
                Some(s) => match &self.symbols[s] {
                    Symbol::Function(func) => func,
                    _ => {
                        panic!("symbol is not function");
                    }
                },
                _ => {
                    panic!("function symbol not found");
                }
            };

            // add arguments to the scope
            let mut symbols = Vec::new();
            for i in 0..func.param_name_vec.len() {
                let name = match func.param_name_vec.get(i) {
                    Some(name) => name,
                    None => panic!(),
                };
                let ty = match func.param_ty_vec.get(i) {
                    Some(ty) => ty,
                    None => panic!(),
                };
                symbols.push(Symbol::Variable(Variable {
                    name: name.clone(),
                    ty: ty.clone(),
                    is_mutable: true,
                }));
            }
            for symbol in symbols {
                self.symbols.push(symbol);
                let symbol_id = self.symbols.len() - 1;
                self.scope.add_symbol(symbol_id);
            }

            for statement in body.iter_mut() {
                self.statement(statement)?;
            }
            self.scope.leave_scope();
        }
        Ok(())
    }

    fn statement(&mut self, node: &mut parse::Node) -> Result<(), CompileError> {
        match node {
            parse::Node::ReturnStatement(Some(expr)) => {
                self.expression(expr)?;
                //self.is_return = true;
            }
            parse::Node::ReturnStatement(None) => {
                //self.is_return = true;
            }
            parse::Node::VariableDeclaration(statement) => {
                return Err(CompileError::new(
                    "variable declaration is not supported yet.",
                ));
                // TODO: use statement.identifier
                // TODO: use statement.attributes
                //self.lower_expression(&statement.body)?
            }
            parse::Node::Assignment(statement) => {
                return Err(CompileError::new("assign statement is not supported yet."));
                // TODO: use statement.identifier
                //self.lower_expression(&statement.body)?
            }
            parse::Node::FunctionDeclaration(_) => {
                return Err(CompileError::new("FuncDeclaration is unexpected"));
            }
            parse::Node::Literal(_)
            | parse::Node::BinaryExpr(_)
            | parse::Node::CallExpr(_)
            | parse::Node::NodeRef(_) => {
                self.expression(node)?;
            }
        };
        Ok(())
    }

    fn expression(&self, node: &mut parse::Node) -> Result<Option<Type>, CompileError> {
        let kind = match node {
            parse::Node::Literal(parse::Literal::Number(_)) => Some(Type::Number),
            parse::Node::BinaryExpr(op) => self.binary_op(op)?,
            parse::Node::CallExpr(call_expr) => self.call_expr(call_expr)?,
            parse::Node::NodeRef(node_ref) => self.identifier(node_ref)?,
            _ => {
                panic!("unexpected node");
            }
        };
        println!("expr {:?}", node);
        Ok(kind)
    }

    fn binary_op(&self, binary_expr: &mut parse::BinaryExpr) -> Result<Option<Type>, CompileError> {
        let left = self.expression(&mut binary_expr.left)?;
        let right = self.expression(&mut binary_expr.right)?;
        if left != right {
            return Err(CompileError::new("binary op type error"));
        }
        Ok(left)
    }

    fn call_expr(&self, call_expr: &mut parse::CallExpr) -> Result<Option<Type>, CompileError> {
        self.expression(&mut call_expr.callee)?;
        let callee_symbol = match call_expr.callee.as_ref() {
            parse::Node::NodeRef(node_ref) => node_ref,
            _ => {
                return Err(CompileError::new("callee is not identifier"));
            }
        };
        let func_symbol = match callee_symbol.resolved {
            Some(s) => match &self.symbols[s] {
                Symbol::Function(func) => func,
                Symbol::Variable(_) => {
                    return Err(CompileError::new("variable cannot be called"));
                }
            },
            None => {
                return Err(CompileError::new("unknown callee"));
            }
        };
        if call_expr.args.len() != func_symbol.param_ty_vec.len() {
            return Err(CompileError::new("parameter count is incorrect"));
        }
        for (i, arg_expr) in call_expr.args.iter_mut().enumerate() {
            let arg_info = self.expression(arg_expr)?;
            match &arg_info {
                Some(arg_kind) => {
                    let param_kind = func_symbol.param_ty_vec.get(i).unwrap();
                    if arg_kind != param_kind {}
                }
                None => return Err(CompileError::new("parameter count is incorrect")),
            }
        }
        let expr_kind = func_symbol.ret_ty.clone();
        Ok(expr_kind)
    }

    fn identifier(&self, node_ref: &mut NodeRef) -> Result<Option<Type>, CompileError> {
        match self.resolve_with_scope(&node_ref.identifier) {
            Some(sym) => {
                node_ref.resolved = Some(sym);
                match &self.symbols[sym] {
                    Symbol::Function(func) => Ok(func.ret_ty.clone()),
                    Symbol::Variable(var) => Ok(Some(var.ty.clone())),
                }
            }
            None => Err(CompileError::new("unknown identifier")),
        }
    }
}

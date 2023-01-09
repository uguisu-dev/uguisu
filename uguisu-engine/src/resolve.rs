use crate::parse::NodeRef;
use crate::parse::{self, ResolvedNodeRef, VariableAttribute};
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
    pub is_func_param: bool,
    pub func_param_index: usize,
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
            None => panic!("layer not found"),
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
        for statement in ast.iter_mut() {
            match statement {
                parse::Node::FunctionDeclaration(func_decl) => {
                    self.function_declaration(func_decl)?;
                }
                _ => {
                    println!("[Warn] unexpected node");
                }
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
        node: &mut parse::FunctionDeclaration,
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
        let is_external = node
            .attributes
            .iter()
            .any(|x| x == &parse::FunctionAttribute::External);
        let func = Function {
            name: node.identifier.clone(),
            param_name_vec,
            param_ty_vec,
            ret_ty,
            is_external,
            codegen_id: None,
        };
        let symbol = Symbol::Function(func);
        self.symbols.push(symbol);
        let symbol_id = self.symbols.len() - 1;
        node.symbol = Some(symbol_id);
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
                        panic!("unexpected error: symbol is not function");
                    }
                },
                _ => {
                    panic!("unexpected error: function symbol not found");
                }
            };

            // add arguments to the scope
            let mut symbols = Vec::new();
            for i in 0..func.param_name_vec.len() {
                let name = match func.param_name_vec.get(i) {
                    Some(name) => name,
                    None => panic!("unexpected error: argument name not found"),
                };
                let ty = match func.param_ty_vec.get(i) {
                    Some(ty) => ty,
                    None => panic!("unexpected error: argument type not found"),
                };
                symbols.push(Symbol::Variable(Variable {
                    name: name.clone(),
                    ty: ty.clone(),
                    is_mutable: true,
                    is_func_param: true,
                    func_param_index: i,
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
                match self.expression(expr)? {
                    Some(_) => {
                        // TODO: return type check
                    }
                    None => {
                        return Err(CompileError::new("The expression does not return a value."));
                    }
                }
            }
            parse::Node::ReturnStatement(None) => {
                // TODO: return type check
            }
            parse::Node::VariableDeclaration(statement) => {
                let ty = match self.expression(&mut statement.body)? {
                    Some(ty) => ty,
                    None => {
                        return Err(CompileError::new("The expression does not return a value."));
                    }
                };
                let is_mutable = statement
                    .attributes
                    .iter()
                    .any(|x| *x == VariableAttribute::Let);
                self.symbols.push(Symbol::Variable(Variable {
                    name: statement.identifier.clone(),
                    ty: ty,
                    is_mutable: is_mutable,
                    is_func_param: false,
                    func_param_index: 0,
                }));
                let symbol_id = self.symbols.len() - 1;
                statement.symbol = Some(symbol_id);
                self.scope.add_symbol(symbol_id);
            }
            parse::Node::Assignment(_statement) => {
                return Err(CompileError::new("assign statement is not supported yet."));
                // TODO: use statement.identifier
                //self.expression(&statement.body)?
            }
            parse::Node::FunctionDeclaration(_) => {
                return Err(CompileError::new("FuncDeclaration is not supported"));
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
            parse::Node::NodeRef(node_ref) => self.node_ref(node_ref)?,
            _ => {
                panic!("unexpected node");
            }
        };
        //println!("expr {:?}", node);
        Ok(kind)
    }

    fn binary_op(&self, binary_expr: &mut parse::BinaryExpr) -> Result<Option<Type>, CompileError> {
        let left = match self.expression(&mut binary_expr.left)? {
            Some(ty) => ty,
            None => return Err(CompileError::new("The expression does not return a value.")),
        };
        let right = match self.expression(&mut binary_expr.right)? {
            Some(ty) => ty,
            None => return Err(CompileError::new("The expression does not return a value.")),
        };
        if left != right {
            return Err(CompileError::new("type error"));
        }
        Ok(Some(left))
    }

    fn call_expr(&self, call_expr: &mut parse::CallExpr) -> Result<Option<Type>, CompileError> {
        let func = match call_expr.callee.as_mut() {
            parse::Node::NodeRef(node_ref) => match self.resolve_with_scope(&node_ref.identifier) {
                Some(sym) => {
                    node_ref.resolved = Some(ResolvedNodeRef { symbol: sym });
                    match &self.symbols[sym] {
                        Symbol::Function(func) => func,
                        Symbol::Variable(_) => {
                            return Err(CompileError::new("the variable is not callable"));
                        }
                    }
                }
                None => {
                    return Err(CompileError::new("unknown identifier"));
                }
            },
            _ => {
                return Err(CompileError::new("unknown callee"));
            }
        };
        if call_expr.args.len() != func.param_ty_vec.len() {
            return Err(CompileError::new("parameter count is incorrect"));
        }
        for (i, arg_expr) in call_expr.args.iter_mut().enumerate() {
            let arg_info = self.expression(arg_expr)?;
            match &arg_info {
                Some(arg_kind) => {
                    let param_kind = func.param_ty_vec.get(i).unwrap();
                    if arg_kind != param_kind {
                        return Err(CompileError::new("parameter type error"));
                    }
                }
                None => return Err(CompileError::new("The expression does not return a value.")),
            }
        }
        let ret_ty = func.ret_ty.clone();
        Ok(ret_ty)
    }

    fn node_ref(&self, node_ref: &mut NodeRef) -> Result<Option<Type>, CompileError> {
        match self.resolve_with_scope(&node_ref.identifier) {
            Some(sym) => match &self.symbols[sym] {
                Symbol::Function(_) => {
                    Err(CompileError::new("Identifier of function is not supported"))
                }
                Symbol::Variable(var) => {
                    node_ref.resolved = Some(ResolvedNodeRef { symbol: sym });
                    Ok(Some(var.ty.clone()))
                }
            },
            None => Err(CompileError::new("unknown identifier")),
        }
    }
}

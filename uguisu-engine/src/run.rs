use crate::analyze::{LiteralValue, Node, NodeId, NodeRef, Operator, Type, FunctionBody};
use crate::RuntimeError;
use crate::parse::AssignmentMode;
use std::collections::HashMap;

mod builtin {
    pub fn print_num(value: i64) {
        print!("{}", value);
    }
    pub fn print_lf() {
        print!("\n");
    }
    pub fn assert_eq(actual: i64, expected: i64) {
        if actual != expected {
            panic!("assertion error");
        }
    }
}

enum StatementResult {
    None,
    Break,
    Return,
    ReturnWith(Symbol),
}

#[derive(Debug, Clone)]
pub enum Symbol {
    NoneValue,
    Number(i64),
    Bool(bool),
    Function(NodeRef),
}

impl Symbol {
    pub fn get_type_name(&self) -> &str {
        match self {
            Symbol::Number(_) => "number",
            Symbol::Bool(_) => "bool",
            Symbol::Function(_) => panic!("get type error"),
            Symbol::NoneValue => panic!("get type error"),
        }
    }

    pub fn as_number(&self) -> i64 {
        match self {
            &Symbol::Number(value) => value,
            _ => panic!("type mismatch: expected `number`, found `{}`", self.get_type_name()),
        }
    }

    pub fn as_bool(&self) -> bool {
        match self {
            &Symbol::Bool(value) => value,
            _ => panic!("type mismatch: expected `bool`, found `{}`", self.get_type_name()),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SymbolTable {
    layers: Vec<SymbolTableLayer>,
}

impl SymbolTable {
    pub fn new() -> Self {
        Self {
            layers: vec![SymbolTableLayer::new()],
        }
    }

    pub fn push_layer(&mut self) {
        self.layers.insert(0, SymbolTableLayer::new());
    }

    pub fn pop_layer(&mut self) {
        if self.layers.len() == 1 {
            panic!("Left the root layer.");
        }
        self.layers.remove(0);
    }

    pub fn set(&mut self, node_ref: NodeRef, symbol: Symbol) {
        match self.layers.get_mut(0) {
            Some(layer) => {
                layer.symbols.insert(node_ref.id, symbol);
            }
            None => panic!("layer not found"),
        }
    }

    pub fn lookup(&self, node_ref: NodeRef) -> Option<&Symbol> {
        for layer in self.layers.iter() {
            match layer.symbols.get(&node_ref.id) {
                Some(x) => return Some(x),
                None => {}
            }
        }
        None
    }
}

#[derive(Debug, Clone)]
struct SymbolTableLayer {
    symbols: HashMap<NodeId, Symbol>,
}

impl SymbolTableLayer {
    pub fn new() -> Self {
        Self {
            symbols: HashMap::new(),
        }
    }
}

pub struct Runner<'a> {
    graph_source: &'a HashMap<NodeId, Node>,
}

impl<'a> Runner<'a> {
    pub fn new(graph_source: &'a HashMap<NodeId, Node>) -> Self {
        Self { graph_source }
    }

    pub fn run(&self, graph: &Vec<NodeRef>, symbols: &mut SymbolTable) -> Result<(), RuntimeError> {
        for &node_ref in graph.iter() {
            self.exec_statement(node_ref, symbols)?;
        }
        Ok(())
    }

    fn exec_block(&self, statements: &Vec<NodeRef>, symbols: &mut SymbolTable) -> Result<StatementResult, RuntimeError> {
        let mut result = StatementResult::None;
        for &node_ref in statements.iter() {
            result = self.exec_statement(node_ref, symbols)?;
            match result {
                StatementResult::None => {}
                StatementResult::Break
                | StatementResult::Return
                | StatementResult::ReturnWith(_) => {
                    break;
                }
            }
        }
        Ok(result)
    }

    fn exec_statement(
        &self,
        node_ref: NodeRef,
        symbols: &mut SymbolTable,
    ) -> Result<StatementResult, RuntimeError> {
        match node_ref.get(self.graph_source) {
            Node::FunctionDeclaration(_) => {
                // TODO: check duplicate
                symbols.set(node_ref, Symbol::Function(node_ref));
                Ok(StatementResult::None)
            }
            Node::VariableDeclaration(variable) => {
                // TODO: check duplicate
                let symbol = self.eval_expr(variable.body, symbols)?;
                symbols.set(node_ref, symbol);
                Ok(StatementResult::None)
            }
            Node::ReturnStatement(None) => {
                Ok(StatementResult::Return)
            }
            Node::ReturnStatement(Some(expr)) => {
                let symbol = self.eval_expr(*expr, symbols)?;
                Ok(StatementResult::ReturnWith(symbol))
            }
            Node::BreakStatement => Ok(StatementResult::Break),
            Node::Assignment(statement) => {
                let curr_symbol = match symbols.lookup(statement.dest) {
                    Some(x) => x,
                    None => panic!("symbol not found (node_id={})", node_ref.id),
                };
                match statement.mode {
                    AssignmentMode::Assign => {
                        let symbol = self.eval_expr(statement.body, symbols)?;
                        symbols.set(statement.dest, symbol);
                    }
                    AssignmentMode::AddAssign => {
                        let restored_value = curr_symbol.as_number();
                        let body_value = self.eval_expr(statement.body, symbols)?.as_number();
                        let value = match restored_value.checked_add(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("add operation overflowed")),
                        };
                        symbols.set(statement.dest, Symbol::Number(value));
                    }
                    AssignmentMode::SubAssign => {
                        let restored_value = curr_symbol.as_number();
                        let body_value = self.eval_expr(statement.body, symbols)?.as_number();
                        let value = match restored_value.checked_sub(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("sub operation overflowed")),
                        };
                        symbols.set(statement.dest, Symbol::Number(value));
                    }
                    AssignmentMode::MultAssign => {
                        let restored_value = curr_symbol.as_number();
                        let body_value = self.eval_expr(statement.body, symbols)?.as_number();
                        let value = match restored_value.checked_mul(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("mult operation overflowed")),
                        };
                        symbols.set(statement.dest, Symbol::Number(value));
                    }
                    AssignmentMode::DivAssign => {
                        let restored_value = curr_symbol.as_number();
                        let body_value = self.eval_expr(statement.body, symbols)?.as_number();
                        let value = match restored_value.checked_div(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("div operation overflowed")),
                        };
                        symbols.set(statement.dest, Symbol::Number(value));
                    }
                    AssignmentMode::ModAssign => {
                        let restored_value = curr_symbol.as_number();
                        let body_value = self.eval_expr(statement.body, symbols)?.as_number();
                        let value = match restored_value.checked_rem(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("mod operation overflowed")),
                        };
                        symbols.set(statement.dest, Symbol::Number(value));
                    }
                }
                Ok(StatementResult::None)
            }
            Node::IfStatement(statement) => {
                let condition = self.eval_expr(statement.condition, symbols)?.as_bool();
                let block = if condition {
                    &statement.then_block
                } else {
                    &statement.else_block
                };
                self.exec_block(block, symbols)
            }
            Node::LoopStatement(body) => {
                let mut result;
                loop {
                    result = self.exec_block(body, symbols)?;
                    match result {
                        StatementResult::None => {}
                        StatementResult::Break => {
                            result = StatementResult::None;
                            break;
                        }
                        StatementResult::Return
                        | StatementResult::ReturnWith(_) => {
                            break;
                        }
                    }
                }
                Ok(result)
            }
            Node::Literal(_)
            | Node::BinaryExpr(_)
            | Node::CallExpr(_)
            | Node::FuncParam(_) => {
                self.eval_expr(node_ref, symbols)?;
                Ok(StatementResult::None)
            }
        }
    }

    fn eval_expr(
        &self,
        node_ref: NodeRef,
        symbols: &mut SymbolTable,
    ) -> Result<Symbol, RuntimeError> {
        match node_ref.get(self.graph_source) {
            Node::VariableDeclaration(_) => {
                match symbols.lookup(node_ref) {
                    Some(x) => Ok(x.clone()),
                    None => panic!("symbol not found (node_id={})", node_ref.id),
                }
            }
            Node::Literal(literal) => {
                match literal.value {
                    LiteralValue::Number(n) => Ok(Symbol::Number(n)),
                    LiteralValue::Bool(value) => Ok(Symbol::Bool(value)),
                }
            }
            Node::BinaryExpr(binary_expr) => {
                match binary_expr.ty {
                    Type::Bool => { // relational operation
                        let left = self.eval_expr(binary_expr.left, symbols)?;
                        let right = self.eval_expr(binary_expr.right, symbols)?;
                        match left {
                            Symbol::Number(l) => {
                                let r = right.as_number();
                                match binary_expr.operator {
                                    Operator::Equal => Ok(Symbol::Bool(l == r)),
                                    Operator::NotEqual => Ok(Symbol::Bool(l != r)),
                                    Operator::LessThan => Ok(Symbol::Bool(l < r)),
                                    Operator::LessThanEqual => Ok(Symbol::Bool(l <= r)),
                                    Operator::GreaterThan => Ok(Symbol::Bool(l > r)),
                                    Operator::GreaterThanEqual => Ok(Symbol::Bool(l >= r)),
                                    _ => panic!("unsupported operation (node_id={})", node_ref.id),
                                }
                            }
                            Symbol::Bool(l) => {
                                let r = right.as_bool();
                                match binary_expr.operator {
                                    Operator::Equal => Ok(Symbol::Bool(l == r)),
                                    Operator::NotEqual => Ok(Symbol::Bool(l != r)),
                                    Operator::LessThan => Ok(Symbol::Bool(l < r)),
                                    Operator::LessThanEqual => Ok(Symbol::Bool(l <= r)),
                                    Operator::GreaterThan => Ok(Symbol::Bool(l > r)),
                                    Operator::GreaterThanEqual => Ok(Symbol::Bool(l >= r)),
                                    _ => panic!("unsupported operation (node_id={})", node_ref.id),
                                }
                            }
                            Symbol::NoneValue => {
                                panic!("invalid operation (node_id={})", node_ref.id)
                            }
                            Symbol::Function(_) => {
                                Err(RuntimeError::new(
                                    format!("function comparison is not supported (node_id={})", node_ref.id).as_str()
                                ))
                            }
                        }
                    }
                    Type::Number => { // arithmetic operation
                        let left = self.eval_expr(binary_expr.left, symbols)?.as_number();
                        let right = self.eval_expr(binary_expr.right, symbols)?.as_number();
                        match binary_expr.operator {
                            Operator::Add => match left.checked_add(right) {
                                Some(x) => Ok(Symbol::Number(x)),
                                None => Err(RuntimeError::new("add operation overflowed")),
                            }
                            Operator::Sub => match left.checked_sub(right) {
                                Some(x) => Ok(Symbol::Number(x)),
                                None => Err(RuntimeError::new("sub operation overflowed")),
                            }
                            Operator::Mult => match left.checked_mul(right) {
                                Some(x) => Ok(Symbol::Number(x)),
                                None => Err(RuntimeError::new("mult operation overflowed")),
                            }
                            Operator::Div => match left.checked_div(right) {
                                Some(x) => Ok(Symbol::Number(x)),
                                None => Err(RuntimeError::new("div operation overflowed")),
                            }
                            Operator::Mod => match left.checked_rem(right) {
                                Some(x) => Ok(Symbol::Number(x)),
                                None => Err(RuntimeError::new("mod operation overflowed")),
                            }
                            _ => panic!("unsupported operation"),
                        }
                    }
                    Type::Void => panic!("unexpected type: void"),
                }
            }
            Node::CallExpr(call_expr) => {
                let symbol = match call_expr.callee.get(self.graph_source) {
                    Node::FunctionDeclaration(func) => {
                        symbols.push_layer();
                        let mut result = None;
                        match &func.body {
                            Some(FunctionBody::Statements(body)) => {
                                for i in 0..func.params.len() {
                                    let param_node = &func.params[i];
                                    let arg_node = &call_expr.args[i];
                                    let arg_symbol = self.eval_expr(*arg_node, symbols)?;
                                    symbols.set(*param_node, arg_symbol);
                                }
                                match self.exec_block(body, symbols)? {
                                    StatementResult::Break => {
                                        return Err(RuntimeError::new(
                                            "break target is missing",
                                        ));
                                    }
                                    StatementResult::ReturnWith(symbol) => {
                                        result = Some(symbol);
                                    }
                                    _ => {}
                                }
                            }
                            Some(FunctionBody::NativeCode) => {
                                let mut args = Vec::new();
                                for i in 0..func.params.len() {
                                    let arg_node = &call_expr.args[i];
                                    let arg_symbol = self.eval_expr(*arg_node, symbols)?;
                                    args.push(arg_symbol);
                                }
                                // TODO: improve builtin
                                if &func.identifier == "print_num" {
                                    if args.len() != 1 {
                                        panic!("parameters count error");
                                    }
                                    let value = args[0].as_number();
                                    builtin::print_num(value);
                                } else if &func.identifier == "print_lf" {
                                    if args.len() != 0 {
                                        panic!("parameters count error");
                                    }
                                    builtin::print_lf();
                                } else if &func.identifier == "assert_eq" {
                                    if args.len() != 2 {
                                        panic!("parameters count error");
                                    }
                                    let actual = args[0].as_number();
                                    let expected = args[0].as_number();
                                    builtin::assert_eq(actual, expected);
                                } else {
                                    return Err(RuntimeError::new("unknown function"));
                                }
                            }
                            None => panic!("function `{}` is not defined (callee={})", func.identifier, call_expr.callee.id),
                        }
                        symbols.pop_layer();
                        match result {
                            Some(x) => x,
                            None => Symbol::NoneValue,
                        }
                    }
                    _ => panic!("callee is not function (callee={})", call_expr.callee.id),
                };
                Ok(symbol)
            }
            Node::FuncParam(_) => {
                match symbols.lookup(node_ref) {
                    Some(x) => Ok(x.clone()),
                    None => panic!("symbol not found (node_id={})", node_ref.id),
                }
            }
            Node::FunctionDeclaration(_)
            | Node::ReturnStatement(None)
            | Node::ReturnStatement(Some(_))
            | Node::BreakStatement
            | Node::Assignment(_)
            | Node::IfStatement(_)
            | Node::LoopStatement(_) => {
                panic!("Failed to evaluate the expression: unsupported node (node_id={})", node_ref.id);
            }
        }
    }
}

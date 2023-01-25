use crate::analyze::{LiteralValue, Node, NodeId, NodeRef, Operator, Type};
use crate::RuntimeError;
use std::collections::HashMap;

mod builtin {
    pub fn print_num(value: i64) {
        println!("{}", value);
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
            Node::ReturnStatement(Some(expr)) => {
                let symbol = self.eval_expr(*expr, symbols)?;
                Ok(StatementResult::ReturnWith(symbol))
            }
            Node::BreakStatement => Ok(StatementResult::Break),
            Node::ReturnStatement(None) => {
                Ok(StatementResult::Return)
            }
            Node::Assignment(statement) => {
                let symbol = self.eval_expr(statement.body, symbols)?;
                symbols.set(statement.dest, symbol);
                Ok(StatementResult::None)
            }
            Node::IfStatement(statement) => {
                let condition = match self.eval_expr(statement.condition, symbols)? {
                    Symbol::Bool(value) => value,
                    _ => panic!("bool expected (node_id={})", statement.condition.id),
                };
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
                    Type::Bool => {
                        let left = self.eval_expr(binary_expr.left, symbols)?;
                        let right = self.eval_expr(binary_expr.right, symbols)?;
                        match left {
                            Symbol::Number(l) => {
                                match right {
                                    Symbol::Number(r) => {
                                        match binary_expr.operator {
                                            Operator::Equal => Ok(Symbol::Bool(l == r)),
                                            Operator::NotEqual => Ok(Symbol::Bool(l != r)),
                                            Operator::LessThan => Ok(Symbol::Bool(l < r)),
                                            Operator::LessThanEqual => Ok(Symbol::Bool(l <= r)),
                                            Operator::GreaterThan => Ok(Symbol::Bool(l > r)),
                                            Operator::GreaterThanEqual => Ok(Symbol::Bool(l >= r)),
                                            _ => panic!("unexpected operator (node_id={})", node_ref.id),
                                        }
                                    }
                                    _ => panic!("number expected (node_id={})", node_ref.id),
                                }
                            }
                            Symbol::Bool(l) => {
                                match right {
                                    Symbol::Bool(r) => {
                                        match binary_expr.operator {
                                            Operator::Equal => Ok(Symbol::Bool(l == r)),
                                            Operator::NotEqual => Ok(Symbol::Bool(l != r)),
                                            Operator::LessThan => Ok(Symbol::Bool(l < r)),
                                            Operator::LessThanEqual => Ok(Symbol::Bool(l <= r)),
                                            Operator::GreaterThan => Ok(Symbol::Bool(l > r)),
                                            Operator::GreaterThanEqual => Ok(Symbol::Bool(l >= r)),
                                            _ => panic!("unexpected operator (node_id={})", node_ref.id),
                                        }
                                    }
                                    _ => panic!("bool expected (node_id={})", node_ref.id),
                                }
                            }
                            Symbol::NoneValue => {
                                panic!("unexpected operation (node_id={})", node_ref.id)
                            }
                            Symbol::Function(_) =>
                                Err(RuntimeError::new(
                                    format!("function comparison is not supported (node_id={})", node_ref.id).as_str()
                                )),
                        }
                    }
                    Type::Number => {
                        let left = match self.eval_expr(binary_expr.left, symbols)? {
                            Symbol::Number(n) => n,
                            _ => panic!("number expected (node_id={})", node_ref.id),
                        };
                        let right = match self.eval_expr(binary_expr.right, symbols)? {
                            Symbol::Number(n) => n,
                            _ => panic!("number expected (node_id={})", node_ref.id),
                        };
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
                            _ => panic!("unexpected operator"),
                        }
                    }
                }
            }
            Node::CallExpr(call_expr) => {
                let symbol = match call_expr.callee.get(self.graph_source) {
                    Node::FunctionDeclaration(func) => {
                        if func.is_native_code {
                            symbols.push_layer();
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
                                let value = match &args[0] {
                                    Symbol::Number(n) => *n,
                                    _ => panic!("number expected {:?}", args[0]),
                                };
                                builtin::print_num(value);
                            } else if &func.identifier == "assert_eq" {
                                if args.len() != 2 {
                                    panic!("parameters count error");
                                }
                                let a = match &args[0] {
                                    Symbol::Number(n) => *n,
                                    _ => panic!("number expected {:?}", args[0]),
                                };
                                let b = match &args[1] {
                                    Symbol::Number(n) => *n,
                                    _ => panic!("number expected {:?}", args[1]),
                                };
                                builtin::assert_eq(a, b);
                            } else {
                                return Err(RuntimeError::new("unknown builtin"));
                            }
                            symbols.pop_layer();
                            Symbol::NoneValue
                        } else {
                            symbols.push_layer();
                            for i in 0..func.params.len() {
                                let param_node = &func.params[i];
                                let arg_node = &call_expr.args[i];
                                let arg_symbol = self.eval_expr(*arg_node, symbols)?;
                                symbols.set(*param_node, arg_symbol);
                            }
                            let mut result = None;
                            match &func.body {
                                Some(body) => {
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
                                None => panic!("function body not found (callee={})", call_expr.callee.id),
                            }
                            symbols.pop_layer();
                            match result {
                                Some(x) => x,
                                None => Symbol::NoneValue,
                            }
                        }
                    }
                    _ => panic!("function expected (callee={})", call_expr.callee.id),
                };
                Ok(symbol)
            }
            Node::FuncParam(_) => {
                match symbols.lookup(node_ref) {
                    Some(x) => Ok(x.clone()),
                    None => panic!("symbol not found (node_id={})", node_ref.id),
                }
            }
            _ => panic!("unexpected expr node (node_id={})", node_ref.id),
        }
    }
}

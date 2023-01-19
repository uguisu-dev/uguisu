use crate::analyze::{LiteralValue, Node, NodeId};
use crate::parse::Operator;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub enum Value {
    None,
    Number(i32),
    Function(NodeId),
}

enum StatementInfo {
    None,
    Return,
    ReturnWith(Value),
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
            panic!("Left the root scope.");
        }
        self.layers.remove(0);
    }

    pub fn set_symbol(&mut self, node_id: NodeId, value: Value) {
        match self.layers.get_mut(0) {
            Some(layer) => {
                layer.symbols.insert(node_id, value);
            }
            None => panic!("layer not found"),
        }
    }
}

#[derive(Debug, Clone)]
struct SymbolTableLayer {
    symbols: HashMap<NodeId, Value>,
}

impl SymbolTableLayer {
    pub fn new() -> Self {
        Self { symbols: HashMap::new() }
    }
}

pub struct Runner<'a> {
    graph_source: &'a HashMap<NodeId, Node>,
}

impl<'a> Runner<'a> {
    pub fn new(graph_source: &'a HashMap<NodeId, Node>) -> Self {
        Self {
            graph_source,
        }
    }

    fn lookup_symbol(&self, node_id: NodeId, symbols: &SymbolTable) -> Option<&Value> {
        todo!();
    }

    fn lookup_node(&self, node_id: NodeId) -> &Node {
        &self.graph_source[&node_id]
    }

    pub fn run(&self, graph: &Vec<NodeId>, symbols: &mut SymbolTable) {
        // execute global statements
        for &node_id in graph.iter() {
            self.exec_statement(node_id, symbols);
        }
        // call main function
        let mut func = None;
        for &node in graph.iter() {
            match self.lookup_node(node) {
                Node::FunctionDeclaration(f) => {
                    if &f.identifier == "main" {
                        func = Some(node);
                        break;
                    }
                }
                _ => {}
            }
        }
        match func {
            Some(node_id) => {
                self.call_func(node_id, symbols);
            }
            None => {
                println!("[Info] main function not found");
            }
        }
    }

    fn call_func(&self, node_id: NodeId, symbols: &mut SymbolTable) {
        match self.lookup_node(node_id) {
            Node::FunctionDeclaration(func) => {
                match &func.body {
                    Some(body) => {
                        for &node_id in body.iter() {
                            self.exec_statement(node_id, symbols);
                        }
                    }
                    None => panic!("function body not found (node_id={})", node_id),
                }
            }
            _ => panic!("function expected (node_id={})", node_id),
        }
    }

    fn exec_statement(&self, node_id: NodeId, symbols: &mut SymbolTable) -> StatementInfo {
        match self.lookup_node(node_id) {
            Node::FunctionDeclaration(_) => {
                symbols.set_symbol(node_id, Value::Function(node_id));
                StatementInfo::None
            }
            Node::VariableDeclaration(variable) => {
                let value = self.eval_expr(variable.body, symbols);
                symbols.set_symbol(node_id, value);
                StatementInfo::None
            }
            Node::ReturnStatement(Some(expr)) => {
                let value = self.eval_expr(*expr, symbols);
                StatementInfo::ReturnWith(value)
            }
            Node::ReturnStatement(None) => {
                StatementInfo::Return
            }
            Node::Assignment(statement) => {
                let value = self.eval_expr(statement.body, symbols);
                symbols.set_symbol(statement.dest, value);
                StatementInfo::None
            }
            Node::Literal(_)
            | Node::BinaryExpr(_)
            | Node::CallExpr(_)
            | Node::FuncParamDeclaration(_) => {
                self.eval_expr(node_id, symbols);
                StatementInfo::None
            }
        }
    }

    fn eval_expr(&self, node_id: NodeId, symbols: &mut SymbolTable) -> Value {
        match self.lookup_node(node_id) {
            Node::Literal(literal) => {
                match literal.value {
                    LiteralValue::Number(n) => {
                        Value::Number(n)
                    }
                }
            }
            Node::BinaryExpr(binary_expr) => {
                let left = match self.eval_expr(binary_expr.left, symbols) {
                    Value::Number(n) => n,
                    _ => panic!("number expected (node_id={})", node_id),
                };
                let right = match self.eval_expr(binary_expr.right, symbols) {
                    Value::Number(n) => n,
                    _ => panic!("number expected (node_id={})", node_id),
                };
                match binary_expr.operator {
                    Operator::Add => Value::Number(left + right),
                    Operator::Sub => Value::Number(left - right),
                    Operator::Mult => Value::Number(left * right),
                    Operator::Div => Value::Number(left / right),
                }
            }
            Node::CallExpr(call_expr) => {
                self.call_func(call_expr.callee, symbols);
                todo!();
            }
            Node::FuncParamDeclaration(_) => {
                match self.lookup_symbol(node_id, symbols) {
                    Some(x) => x.clone(),
                    None => panic!("symbol not found (node_id={})", node_id),
                }
            }
            _ => panic!("unexpected expr node (node_id={})", node_id),
        }
    }
}

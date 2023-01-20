use crate::analyze::{LiteralValue, Node, NodeLink, NodeId, FunctionDeclaration, FuncParamDeclaration};
use crate::parse::Operator;
use std::collections::HashMap;

mod builtin {
    pub fn print_num(value: i32) {
        println!("{}", value);
    }
}

#[derive(Debug, Clone)]
pub enum Value {
    None,
    Number(i32),
    Function(NodeLink),
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

    pub fn set_symbol(&mut self, node_link: NodeLink, value: Value) {
        match self.layers.get_mut(0) {
            Some(layer) => {
                layer.symbols.insert(node_link.id, value);
            }
            None => panic!("layer not found"),
        }
    }

    pub fn lookup(&self, node_link: NodeLink) -> Option<Value> {
        for layer in self.layers.iter() {
            match layer.symbols.get(&node_link.id) {
                Some(x) => return Some(x.clone()),
                None => {},
            }
        }
        None
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

    pub fn run(&self, graph: &Vec<NodeLink>, symbols: &mut SymbolTable) {
        // execute global statements
        for &node_link in graph.iter() {
            self.exec_statement(node_link, symbols);
        }
        // call main function
        let mut func = None;
        for &node_link in graph.iter() {
            match node_link.as_node(self.graph_source) {
                Node::FunctionDeclaration(f) => {
                    if &f.identifier == "main" {
                        func = Some(node_link);
                        break;
                    }
                }
                _ => {}
            }
        }
        match func {
            Some(node_link) => {
                //self.call_func(node_link, &Vec::new(), symbols);
            }
            None => {
                println!("[Info] main function not found");
            }
        }
    }

    fn exec_statement(&self, node_link: NodeLink, symbols: &mut SymbolTable) -> StatementInfo {
        match node_link.as_node(self.graph_source) {
            Node::FunctionDeclaration(_) => {
                symbols.set_symbol(node_link, Value::Function(node_link));
                StatementInfo::None
            }
            Node::VariableDeclaration(variable) => {
                let value = self.eval_expr(variable.body, symbols);
                symbols.set_symbol(node_link, value);
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
                self.eval_expr(node_link, symbols);
                StatementInfo::None
            }
        }
    }

    fn eval_expr(&self, node_link: NodeLink, symbols: &mut SymbolTable) -> Value {
        match node_link.as_node(self.graph_source) {
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
                    _ => panic!("number expected (node_id={})", node_link.id),
                };
                let right = match self.eval_expr(binary_expr.right, symbols) {
                    Value::Number(n) => n,
                    _ => panic!("number expected (node_id={})", node_link.id),
                };
                match binary_expr.operator {
                    Operator::Add => Value::Number(left + right),
                    Operator::Sub => Value::Number(left - right),
                    Operator::Mult => Value::Number(left * right),
                    Operator::Div => Value::Number(left / right),
                }
            }
            Node::CallExpr(call_expr) => {
                println!("call args {:?}", call_expr.args);
                match call_expr.callee.as_node(self.graph_source) {
                    Node::FunctionDeclaration(func) => {
                        if func.is_external {
                            // if &func.identifier == "print_num" {
                            //     let params: Vec<NodeLink> = Vec::new();
                            //     if params.len() != func.params.len() {
                            //         panic!("parameters count error");
                            //     }
                            //     for param in func.params.iter() {
                            //         match param.as_node(self.graph_source) {
                            //             Node::FuncParamDeclaration(decl) => {
                            //                 // TODO
                            //             }
                            //             _ => panic!("func param expected"),
                            //         }
                            //     }
                            // }
                            println!("[Info] external function called");
                        } else {
                            // TODO: arguments
                            match &func.body {
                                Some(body) => {
                                    for &node_link in body.iter() {
                                        self.exec_statement(node_link, symbols);
                                    }
                                }
                                None => panic!("function body not found (callee={})", call_expr.callee.id),
                            }
                        }
                        Value::None
                    }
                    _ => panic!("function expected (callee={})", call_expr.callee.id),
                }
            }
            Node::FuncParamDeclaration(_) => {
                match symbols.lookup(node_link) {
                    Some(x) => x,
                    None => panic!("symbol not found (node_id={})", node_link.id),
                }
            }
            _ => panic!("unexpected expr node (node_id={})", node_link.id),
        }
    }
}

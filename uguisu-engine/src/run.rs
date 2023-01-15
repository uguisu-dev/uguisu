use crate::analyze::{LiteralValue, Node, NodeId};
use crate::parse::Operator;
use std::collections::HashMap;

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

pub struct Runner<'a> {
    graph_source: &'a HashMap<NodeId, Node>,
}

impl<'a> Runner<'a> {
    pub fn new(graph_source: &'a HashMap<NodeId, Node>) -> Self {
        Self {
            graph_source,
        }
    }

    fn set_symbol(symbols: &mut HashMap<NodeId, Value>, node: NodeId, value: Value) {
        symbols.insert(node, value);
    }

    fn lookup_node(&self, node_id: NodeId) -> &Node {
        &self.graph_source[&node_id]
    }

    // 文を実行し、main関数の実行をする。
    pub fn run(&self, graph: &Vec<NodeId>, symbols: &mut HashMap<NodeId, Value>) {
        for &node_id in graph.iter() {
            self.exec_statement(node_id, symbols);
        }
        // find main function
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

    fn call_func(&self, node_id: NodeId, symbols: &mut HashMap<NodeId, Value>) {
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

    // 宣言の解釈やvariableへの登録をする。
    fn exec_statement(&self, node_id: NodeId, symbols: &mut HashMap<NodeId, Value>) -> StatementInfo {
        match self.lookup_node(node_id) {
            Node::FunctionDeclaration(_) => {
                Self::set_symbol(symbols, node_id, Value::Function(node_id));
                StatementInfo::None
            }
            Node::VariableDeclaration(variable) => {
                let a = self.eval_expr(variable.body, symbols);
                Self::set_symbol(symbols, node_id, a);
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
                Self::set_symbol(symbols, statement.dest, value);
                StatementInfo::None
            }
            Node::Literal(_) | Node::BinaryExpr(_) | Node::CallExpr(_) | Node::FuncParamDeclaration(_) => {
                self.eval_expr(node_id, symbols);
                StatementInfo::None
            }
            _ => panic!("unexpected statement node (node_id={})", node_id),
        }
    }

    fn eval_expr(&self, node_id: NodeId, symbols: &mut HashMap<NodeId, Value>) -> Value {
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
                let callee = match self.lookup_node(call_expr.callee) {
                    Node::FunctionDeclaration(func) => func,
                    _ => panic!("function expected (node_id={})", node_id),
                };
                self.call_func(call_expr.callee, symbols);
                todo!();
            }
            Node::FuncParamDeclaration(_) => {
                todo!();
            }
            _ => panic!("unexpected expr node (node_id={})", node_id),
        }
    }
}

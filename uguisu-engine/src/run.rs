use crate::analyze::{LiteralValue, Node, NodeId};
use crate::parse::Operator;
use std::collections::HashMap;

#[derive(Debug, PartialEq, Clone)]
pub enum Value {
    Number(i32),
    Function(NodeId),
}

pub struct Runner<'a> {
    graph_source: &'a HashMap<NodeId, Node>,
    symbols: HashMap<NodeId, Value>,
}

impl<'a> Runner<'a> {
    pub fn new(graph_source: &'a HashMap<NodeId, Node>) -> Self {
        Self {
            graph_source,
            symbols: HashMap::new(),
        }
    }

    fn add_symbol(&mut self, node: NodeId, value: Value) {
        self.symbols.insert(node, value);
    }

    fn lookup_node(&self, node_id: NodeId) -> &Node {
        &self.graph_source[&node_id]
    }

    // 文を実行し、main関数の実行をする。
    pub fn run(&self, graph: &Vec<NodeId>) {
        // let mut func = None;
        // for node in graph.iter() {
        //     match self.lookup_node(node) {
        //         Node::FunctionDeclaration(f) => {
        //             if &f.identifier == "main" {
        //                 func = Some(node);
        //                 break;
        //             }
        //         }
        //         _ => {}
        //     }
        // }
        // match func {
        //     Some(&x) => {
        //         self.exec_statement(x);
        //     }
        //     None => {
        //         println!("[Info] main function not found");
        //     }
        // }
        todo!();
    }

    // 宣言の解釈やvariableへの登録をする。
    pub fn exec_statement(&self, node_id: NodeId) {
        // match self.lookup_node(node_id) {
        //     Node::FunctionDeclaration(_) => {
        //         Value::Function(node_id);
        //     }
        //     _ => panic!("unexpected statement node"),
        // }
        todo!();
    }

    fn eval_expr(&self, node_id: NodeId) -> Value {
        match self.lookup_node(node_id) {
            Node::Literal(literal) => {
                match literal.value {
                    LiteralValue::Number(n) => {
                        Value::Number(n)
                    }
                }
            }
            Node::BinaryExpr(binary_expr) => {
                let left = match self.eval_expr(binary_expr.left) {
                    Value::Number(n) => n,
                    _ => panic!("number expected"),
                };
                let right = match self.eval_expr(binary_expr.right) {
                    Value::Number(n) => n,
                    _ => panic!("number expected"),
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
                    _ => panic!("function expected"),
                };
                todo!();
            }
            Node::FuncParamDeclaration(func_param) => {
                todo!();
            }
            _ => panic!("unexpected expr node"),
        }
    }
}

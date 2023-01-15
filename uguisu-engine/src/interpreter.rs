use std::collections::HashMap;
use crate::graph::{NodeId, Node, LiteralValue};
use crate::parse::Operator;

#[derive(Debug, PartialEq, Clone)]
pub enum Value {
    Number(i32),
    Function(NodeId),
}

pub struct Interpreter<'a> {
    graph_nodes: &'a HashMap<NodeId, Node>,
    variables: HashMap<NodeId, Value>,
}

impl<'a> Interpreter<'a> {
    pub fn new(graph_nodes: &'a HashMap<NodeId, Node>) -> Self {
        Self {
            graph_nodes,
            variables: HashMap::new(),
        }
    }

    fn lookup_node(&self, node_id: NodeId) -> &Node {
        &self.graph_nodes[&node_id]
    }

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

use crate::analyze::{LiteralValue, Node, NodeRef, NodeId};
use crate::parse::Operator;
use std::collections::HashMap;

mod builtin {
    pub fn print_num(value: i32) {
        println!("{}", value);
    }
}

enum StatementResult {
    None,
    Return,
    ReturnWith(Symbol),
}

#[derive(Debug, Clone)]
pub enum Symbol {
    NoneValue,
    Number(i32),
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
            panic!("Left the root scope.");
        }
        self.layers.remove(0);
    }

    pub fn set_symbol(&mut self, node_ref: NodeRef, symbol: Symbol) {
        match self.layers.get_mut(0) {
            Some(layer) => {
                layer.symbols.insert(node_ref.id, symbol);
            }
            None => panic!("layer not found"),
        }
    }

    pub fn lookup_symbol(&self, node_ref: NodeRef) -> Option<Symbol> {
        for layer in self.layers.iter() {
            match layer.symbols.get(&node_ref.id) {
                Some(x) => return Some(x.clone()),
                None => {},
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

    pub fn run(&self, graph: &Vec<NodeRef>, symbols: &mut SymbolTable) {
        for &node_ref in graph.iter() {
            self.exec_statement(node_ref, symbols);
        }
    }

    fn exec_statement(&self, node_ref: NodeRef, symbols: &mut SymbolTable) -> StatementResult {
        match node_ref.as_node(self.graph_source) {
            Node::FunctionDeclaration(_) => {
                //println!("FunctionDeclaration");
                symbols.set_symbol(node_ref, Symbol::Function(node_ref));
                StatementResult::None
            }
            Node::VariableDeclaration(variable) => {
                //println!("VariableDeclaration");
                let symbol = self.eval_expr(variable.body, symbols);
                symbols.set_symbol(node_ref, symbol);
                StatementResult::None
            }
            Node::ReturnStatement(Some(expr)) => {
                //println!("ReturnStatement");
                let symbol = self.eval_expr(*expr, symbols);
                StatementResult::ReturnWith(symbol)
            }
            Node::ReturnStatement(None) => {
                //println!("ReturnStatement");
                StatementResult::Return
            }
            Node::Assignment(statement) => {
                //println!("Assignment");
                let symbol = self.eval_expr(statement.body, symbols);
                symbols.set_symbol(statement.dest, symbol);
                StatementResult::None
            }
            Node::Literal(_)
            | Node::BinaryExpr(_)
            | Node::CallExpr(_)
            | Node::FuncParam(_) => {
                //println!("ExprStatement");
                self.eval_expr(node_ref, symbols);
                StatementResult::None
            }
        }
    }

    fn eval_expr(&self, node_ref: NodeRef, symbols: &mut SymbolTable) -> Symbol {
        match node_ref.as_node(self.graph_source) {
            Node::Literal(literal) => {
                //println!("Literal");
                match literal.value {
                    LiteralValue::Number(n) => {
                        Symbol::Number(n)
                    }
                }
            }
            Node::BinaryExpr(binary_expr) => {
                //println!("BinaryExpr");
                let left = match self.eval_expr(binary_expr.left, symbols) {
                    Symbol::Number(n) => n,
                    _ => panic!("number expected (node_id={})", node_ref.id),
                };
                let right = match self.eval_expr(binary_expr.right, symbols) {
                    Symbol::Number(n) => n,
                    _ => panic!("number expected (node_id={})", node_ref.id),
                };
                match binary_expr.operator {
                    Operator::Add => Symbol::Number(left + right),
                    Operator::Sub => Symbol::Number(left - right),
                    Operator::Mult => Symbol::Number(left * right),
                    Operator::Div => Symbol::Number(left / right),
                }
            }
            Node::CallExpr(call_expr) => {
                //println!("CallExpr");
                let symbol = match call_expr.callee.as_node(self.graph_source) {
                    Node::FunctionDeclaration(func) => {
                        if func.is_external {
                            // TODO: static binding
                            symbols.push_layer();
                            let mut args = Vec::new();
                            for i in 0..func.params.len() {
                                //let param_node = &func.params[i];
                                let arg_node = &call_expr.args[i];
                                let arg_symbol = self.eval_expr(*arg_node, symbols);
                                args.push(arg_symbol);
                                //symbols.set_symbol(*param_node, arg_symbol);
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
                            } else {
                                panic!("unknown builtin");
                            }
                            symbols.pop_layer();
                            Symbol::NoneValue
                        } else {
                            // TODO: static binding
                            symbols.push_layer();
                            for i in 0..func.params.len() {
                                let param_node = &func.params[i];
                                let arg_node = &call_expr.args[i];
                                let arg_symbol = self.eval_expr(*arg_node, symbols);
                                symbols.set_symbol(*param_node, arg_symbol);
                            }
                            let mut result = None;
                            match &func.body {
                                Some(body) => {
                                    for &node_ref in body.iter() {
                                        match self.exec_statement(node_ref, symbols) {
                                            StatementResult::None => {}
                                            StatementResult::Return => {
                                                break;
                                            }
                                            StatementResult::ReturnWith(symbol) => {
                                                result = Some(symbol);
                                                break;
                                            }
                                        }
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
                symbol
            }
            Node::FuncParam(_) => {
                //println!("FuncParam");
                match symbols.lookup_symbol(node_ref) {
                    Some(x) => x,
                    None => panic!("symbol not found (node_id={})", node_ref.id),
                }
            }
            _ => panic!("unexpected expr node (node_id={})", node_ref.id),
        }
    }
}

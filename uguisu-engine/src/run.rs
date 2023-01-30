use crate::analyze::{LiteralValue, Node, NodeId, NodeRef, Operator, Type, FunctionBody};
use crate::RuntimeError;
use crate::parse::AssignmentMode;
use std::collections::HashMap;

// TODO: improve builtin
mod builtin {
    use crate::RuntimeError;
    use crate::run::Symbol;

    pub fn print_num(args: &Vec<Symbol>) -> Result<(), RuntimeError> {
        let value = args[0].as_number(); // value: number
        print!("{}", value);
        Ok(())
    }

    pub fn print_lf(_args: &Vec<Symbol>) -> Result<(), RuntimeError> {
        print!("\n");
        Ok(())
    }

    pub fn assert_eq(args: &Vec<Symbol>) -> Result<(), RuntimeError> {
        let actual = args[0].as_number(); // actual: number
        let expected = args[1].as_number(); // expected: number
        if actual != expected {
            return Err(RuntimeError::new("assertion error"));
        }
        Ok(())
    }
}

enum StatementResult {
    None,
    Break,
    Return,
    ReturnWith(Symbol),
}

#[derive(Clone)]
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

pub struct RuningStack {
    frames: Vec<StackFrame>,
}

impl RuningStack {
    pub fn new() -> Self {
        Self {
            frames: vec![StackFrame::new()],
        }
    }

    pub fn push_frame(&mut self) {
        self.frames.insert(0, StackFrame::new());
    }

    pub fn pop_frame(&mut self) {
        if self.frames.len() == 1 {
            panic!("Left the root frame.");
        }
        self.frames.remove(0);
    }

    pub fn set_symbol(&mut self, node_ref: NodeRef, symbol: Symbol) {
        match self.frames.get_mut(0) {
            Some(frame) => {
                frame.table.insert(node_ref.id, symbol);
            }
            None => panic!("frame not found"),
        }
    }

    pub fn lookup_symbol(&self, node_ref: NodeRef) -> Option<&Symbol> {
        for frame in self.frames.iter() {
            match frame.table.get(&node_ref.id) {
                Some(x) => return Some(x),
                None => {}
            }
        }
        None
    }
}

struct StackFrame {
    table: HashMap<NodeId, Symbol>,
}

impl StackFrame {
    pub fn new() -> Self {
        Self {
            table: HashMap::new(),
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

    pub fn run(&self, graph: &Vec<NodeRef>, stack: &mut RuningStack) -> Result<(), RuntimeError> {
        for &node_ref in graph.iter() {
            self.exec_statement(node_ref, stack)?;
        }
        Ok(())
    }

    fn exec_block(&self, statements: &Vec<NodeRef>, stack: &mut RuningStack) -> Result<StatementResult, RuntimeError> {
        let mut result = StatementResult::None;
        for &node_ref in statements.iter() {
            result = self.exec_statement(node_ref, stack)?;
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
        stack: &mut RuningStack,
    ) -> Result<StatementResult, RuntimeError> {
        match node_ref.get(self.graph_source) {
            Node::FunctionDeclaration(_) => {
                // TODO: check duplicate
                stack.set_symbol(node_ref, Symbol::Function(node_ref));
                Ok(StatementResult::None)
            }
            Node::VariableDeclaration(variable) => {
                // TODO: check duplicate
                let symbol = self.eval_expr(variable.body, stack)?;
                stack.set_symbol(node_ref, symbol);
                Ok(StatementResult::None)
            }
            Node::ReturnStatement(statement) => {
                match &statement.body {
                    Some(expr) => {
                        let symbol = self.eval_expr(*expr, stack)?;
                        Ok(StatementResult::ReturnWith(symbol))
                    }
                    None => {
                        Ok(StatementResult::Return)
                    }
                }
            }
            Node::BreakStatement(_) => Ok(StatementResult::Break),
            Node::Assignment(statement) => {
                let curr_symbol = match stack.lookup_symbol(statement.dest) {
                    Some(x) => x,
                    None => panic!("symbol not found (node_id={})", node_ref.id),
                };
                match statement.mode {
                    AssignmentMode::Assign => {
                        let symbol = self.eval_expr(statement.body, stack)?;
                        stack.set_symbol(statement.dest, symbol);
                    }
                    AssignmentMode::AddAssign => {
                        let restored_value = curr_symbol.as_number();
                        let body_value = self.eval_expr(statement.body, stack)?.as_number();
                        let value = match restored_value.checked_add(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("add operation overflowed")),
                        };
                        stack.set_symbol(statement.dest, Symbol::Number(value));
                    }
                    AssignmentMode::SubAssign => {
                        let restored_value = curr_symbol.as_number();
                        let body_value = self.eval_expr(statement.body, stack)?.as_number();
                        let value = match restored_value.checked_sub(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("sub operation overflowed")),
                        };
                        stack.set_symbol(statement.dest, Symbol::Number(value));
                    }
                    AssignmentMode::MultAssign => {
                        let restored_value = curr_symbol.as_number();
                        let body_value = self.eval_expr(statement.body, stack)?.as_number();
                        let value = match restored_value.checked_mul(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("mult operation overflowed")),
                        };
                        stack.set_symbol(statement.dest, Symbol::Number(value));
                    }
                    AssignmentMode::DivAssign => {
                        let restored_value = curr_symbol.as_number();
                        let body_value = self.eval_expr(statement.body, stack)?.as_number();
                        let value = match restored_value.checked_div(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("div operation overflowed")),
                        };
                        stack.set_symbol(statement.dest, Symbol::Number(value));
                    }
                    AssignmentMode::ModAssign => {
                        let restored_value = curr_symbol.as_number();
                        let body_value = self.eval_expr(statement.body, stack)?.as_number();
                        let value = match restored_value.checked_rem(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("mod operation overflowed")),
                        };
                        stack.set_symbol(statement.dest, Symbol::Number(value));
                    }
                }
                Ok(StatementResult::None)
            }
            Node::IfStatement(statement) => {
                let condition = self.eval_expr(statement.condition, stack)?.as_bool();
                let block = if condition {
                    &statement.then_block
                } else {
                    &statement.else_block
                };
                self.exec_block(block, stack)
            }
            Node::LoopStatement(statement) => {
                let mut result;
                loop {
                    result = self.exec_block(&statement.body, stack)?;
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
                self.eval_expr(node_ref, stack)?;
                Ok(StatementResult::None)
            }
        }
    }

    fn eval_expr(
        &self,
        node_ref: NodeRef,
        stack: &mut RuningStack,
    ) -> Result<Symbol, RuntimeError> {
        match node_ref.get(self.graph_source) {
            Node::VariableDeclaration(_) => {
                match stack.lookup_symbol(node_ref) {
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
                        let left = self.eval_expr(binary_expr.left, stack)?;
                        let right = self.eval_expr(binary_expr.right, stack)?;
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
                        let left = self.eval_expr(binary_expr.left, stack)?.as_number();
                        let right = self.eval_expr(binary_expr.right, stack)?.as_number();
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
                        stack.push_frame();
                        let mut result = None;
                        match &func.body {
                            Some(FunctionBody::Statements(body)) => {
                                for i in 0..func.params.len() {
                                    let param_node = &func.params[i];
                                    let arg_node = &call_expr.args[i];
                                    let arg_symbol = self.eval_expr(*arg_node, stack)?;
                                    stack.set_symbol(*param_node, arg_symbol);
                                }
                                match self.exec_block(body, stack)? {
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
                                    let arg_symbol = self.eval_expr(*arg_node, stack)?;
                                    args.push(arg_symbol);
                                }
                                if call_expr.args.len() != func.params.len() {
                                    return Err(RuntimeError::new("parameters count error"));
                                }
                                // TODO: improve builtin
                                if &func.identifier == "print_num" {
                                    builtin::print_num(&args)?;
                                } else if &func.identifier == "print_lf" {
                                    builtin::print_lf(&args)?;
                                } else if &func.identifier == "assert_eq" {
                                    builtin::assert_eq(&args)?;
                                } else {
                                    return Err(RuntimeError::new("unknown native function"));
                                }
                            }
                            None => panic!("function `{}` is not defined (callee={})", func.identifier, call_expr.callee.id),
                        }
                        stack.pop_frame();
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
                match stack.lookup_symbol(node_ref) {
                    Some(x) => Ok(x.clone()),
                    None => panic!("symbol not found (node_id={})", node_ref.id),
                }
            }
            Node::FunctionDeclaration(_)
            | Node::ReturnStatement(_)
            | Node::BreakStatement(_)
            | Node::Assignment(_)
            | Node::IfStatement(_)
            | Node::LoopStatement(_) => {
                panic!("Failed to evaluate the expression: unsupported node (node_id={})", node_ref.id);
            }
        }
    }
}

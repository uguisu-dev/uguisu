use crate::ast::AssignmentMode;
use crate::graph::{self, LiteralValue, Operator};
use crate::types::Type;
use crate::RuntimeError;
use std::collections::HashMap;

// TODO: improve builtin
mod builtin {
    use crate::RuntimeError;
    use crate::run::Value;

    pub(crate) fn print_num(args: &Vec<Value>) -> Result<(), RuntimeError> {
        let value = args[0].as_number(); // value: number
        print!("{}", value);
        Ok(())
    }

    pub(crate) fn print_lf(_args: &Vec<Value>) -> Result<(), RuntimeError> {
        print!("\n");
        Ok(())
    }

    pub(crate) fn assert_eq(args: &Vec<Value>) -> Result<(), RuntimeError> {
        let actual = args[0].as_number(); // actual: number
        let expected = args[1].as_number(); // expected: number
        if actual != expected {
            return Err(RuntimeError::new(format!("assertion error. expected `{}`, actual `{}`.", expected, actual).as_str()));
        }
        Ok(())
    }
}

enum StatementResult {
    None,
    Break,
    Return,
    ReturnWith(Value),
}

pub(crate) type SymbolAddress = usize;

#[derive(Clone)]
pub(crate) enum Value {
    NoneValue,
    Number(i64),
    Bool(bool),
    Function(SymbolAddress),
}

impl Value {
    pub(crate) fn get_type_name(&self) -> &str {
        match self {
            Value::Number(_) => "number",
            Value::Bool(_) => "bool",
            Value::Function(_) => panic!("get type error"),
            Value::NoneValue => panic!("get type error"),
        }
    }

    pub(crate) fn as_number(&self) -> i64 {
        match self {
            &Value::Number(value) => value,
            _ => panic!("type mismatched. expected `number`, found `{}`", self.get_type_name()),
        }
    }

    pub(crate) fn as_bool(&self) -> bool {
        match self {
            &Value::Bool(value) => value,
            _ => panic!("type mismatched. expected `bool`, found `{}`", self.get_type_name()),
        }
    }
}

pub(crate) struct RuningStack {
    frames: Vec<StackFrame>,
}

impl RuningStack {
    pub(crate) fn new() -> Self {
        Self {
            frames: vec![StackFrame::new()],
        }
    }

    pub(crate) fn push_frame(&mut self) {
        self.frames.insert(0, StackFrame::new());
    }

    pub(crate) fn pop_frame(&mut self) {
        if self.frames.len() == 1 {
            panic!("Left the root frame.");
        }
        self.frames.remove(0);
    }

    pub(crate) fn set_symbol(&mut self, address: SymbolAddress, value: Value) {
        match self.frames.get_mut(0) {
            Some(frame) => {
                frame.table.insert(address, value);
            }
            None => panic!("frame not found"),
        }
    }

    pub(crate) fn get_symbol(&self, address: SymbolAddress) -> Option<&Value> {
        for frame in self.frames.iter() {
            match frame.table.get(&address) {
                Some(x) => return Some(x),
                None => {}
            }
        }
        None
    }
}

struct StackFrame {
    table: HashMap<graph::NodeId, Value>,
}

impl StackFrame {
    pub(crate) fn new() -> Self {
        Self {
            table: HashMap::new(),
        }
    }
}

pub(crate) struct Runner<'a> {
    source: &'a HashMap<graph::NodeId, graph::Node>,
}

impl<'a> Runner<'a> {
    pub(crate) fn new(source: &'a HashMap<graph::NodeId, graph::Node>) -> Self {
        Self {
            source,
        }
    }

    fn resolve_address(&self, node_ref: graph::NodeRef) -> SymbolAddress {
        match node_ref.get(self.source) {
            graph::Node::FunctionDeclaration(_) => node_ref.id,
            graph::Node::VariableDeclaration(_) => node_ref.id,
            graph::Node::Reference(reference) => self.resolve_address(reference.dest),
            graph::Node::Literal(_) => node_ref.id,
            graph::Node::BinaryExpr(_) => node_ref.id,
            graph::Node::CallExpr(_) => node_ref.id,
            graph::Node::FuncParam(_) => node_ref.id,
            graph::Node::BreakStatement(_)
            | graph::Node::ReturnStatement(_)
            | graph::Node::Assignment(_)
            | graph::Node::IfStatement(_)
            | graph::Node::LoopStatement(_) => {
                panic!("unexpected (node_id={})", node_ref.id);
            }
        }
    }

    pub(crate) fn run(&self, graph: &Vec<graph::NodeRef>, stack: &mut RuningStack) -> Result<(), RuntimeError> {
        for &node_ref in graph.iter() {
            self.exec_statement(node_ref, stack)?;
        }
        Ok(())
    }

    fn exec_block(&self, statements: &Vec<graph::NodeRef>, stack: &mut RuningStack) -> Result<StatementResult, RuntimeError> {
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
        node_ref: graph::NodeRef,
        stack: &mut RuningStack,
    ) -> Result<StatementResult, RuntimeError> {
        match node_ref.get(self.source) {
            graph::Node::FunctionDeclaration(_) => {
                // TODO: check duplicate
                stack.set_symbol(node_ref.id, Value::Function(node_ref.id));
                Ok(StatementResult::None)
            }
            graph::Node::VariableDeclaration(variable) => {
                // TODO: check duplicate
                let value = self.eval_expr(variable.body, stack)?;
                stack.set_symbol(node_ref.id, value);
                Ok(StatementResult::None)
            }
            graph::Node::ReturnStatement(statement) => {
                match &statement.body {
                    Some(expr) => {
                        let value = self.eval_expr(*expr, stack)?;
                        Ok(StatementResult::ReturnWith(value))
                    }
                    None => {
                        Ok(StatementResult::Return)
                    }
                }
            }
            graph::Node::BreakStatement(_) => Ok(StatementResult::Break),
            graph::Node::Assignment(statement) => {
                let curr_value = self.eval_expr(statement.dest, stack)?;
                // let curr_symbol = match stack.lookup_symbol(statement.dest) {
                //     Some(x) => x,
                //     None => panic!("symbol not found (node_id={})", node_ref.id),
                // };
                match statement.mode {
                    AssignmentMode::Assign => {
                        let address = self.resolve_address(statement.dest);
                        let value = self.eval_expr(statement.body, stack)?;
                        stack.set_symbol(address, value);
                    }
                    AssignmentMode::AddAssign => {
                        let address = self.resolve_address(statement.dest);
                        let restored_value = curr_value.as_number();
                        let body_value = self.eval_expr(statement.body, stack)?.as_number();
                        let value = match restored_value.checked_add(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("add operation overflowed")),
                        };
                        stack.set_symbol(address, Value::Number(value));
                    }
                    AssignmentMode::SubAssign => {
                        let address = self.resolve_address(statement.dest);
                        let restored_value = curr_value.as_number();
                        let body_value = self.eval_expr(statement.body, stack)?.as_number();
                        let value = match restored_value.checked_sub(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("sub operation overflowed")),
                        };
                        stack.set_symbol(address, Value::Number(value));
                    }
                    AssignmentMode::MultAssign => {
                        let address = self.resolve_address(statement.dest);
                        let restored_value = curr_value.as_number();
                        let body_value = self.eval_expr(statement.body, stack)?.as_number();
                        let value = match restored_value.checked_mul(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("mult operation overflowed")),
                        };
                        stack.set_symbol(address, Value::Number(value));
                    }
                    AssignmentMode::DivAssign => {
                        let address = self.resolve_address(statement.dest);
                        let restored_value = curr_value.as_number();
                        let body_value = self.eval_expr(statement.body, stack)?.as_number();
                        let value = match restored_value.checked_div(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("div operation overflowed")),
                        };
                        stack.set_symbol(address, Value::Number(value));
                    }
                    AssignmentMode::ModAssign => {
                        let address = self.resolve_address(statement.dest);
                        let restored_value = curr_value.as_number();
                        let body_value = self.eval_expr(statement.body, stack)?.as_number();
                        let value = match restored_value.checked_rem(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("mod operation overflowed")),
                        };
                        stack.set_symbol(address, Value::Number(value));
                    }
                }
                Ok(StatementResult::None)
            }
            graph::Node::IfStatement(statement) => {
                let condition = self.eval_expr(statement.condition, stack)?.as_bool();
                let block = if condition {
                    &statement.then_block
                } else {
                    &statement.else_block
                };
                self.exec_block(block, stack)
            }
            graph::Node::LoopStatement(statement) => {
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
            graph::Node::Reference(_)
            | graph::Node::Literal(_)
            | graph::Node::BinaryExpr(_)
            | graph::Node::CallExpr(_)
            | graph::Node::FuncParam(_) => {
                self.eval_expr(node_ref, stack)?;
                Ok(StatementResult::None)
            }
        }
    }

    fn eval_expr(
        &self,
        node_ref: graph::NodeRef,
        stack: &mut RuningStack,
    ) -> Result<Value, RuntimeError> {
        match node_ref.get(self.source) {
            graph::Node::Reference(reference) => {
                let address = self.resolve_address(reference.dest);
                match stack.get_symbol(address) {
                    Some(x) => Ok(x.clone()),
                    None => panic!("symbol not found (node_id={}, address={})", node_ref.id, address),
                }
            }
            graph::Node::Literal(literal) => {
                match literal.value {
                    LiteralValue::Number(n) => Ok(Value::Number(n)),
                    LiteralValue::Bool(value) => Ok(Value::Bool(value)),
                }
            }
            graph::Node::BinaryExpr(binary_expr) => {
                match binary_expr.ty {
                    Type::Bool => { // relational operation
                        let left = self.eval_expr(binary_expr.left, stack)?;
                        let right = self.eval_expr(binary_expr.right, stack)?;
                        match left {
                            Value::Number(l) => {
                                let r = right.as_number();
                                match binary_expr.operator {
                                    Operator::Equal => Ok(Value::Bool(l == r)),
                                    Operator::NotEqual => Ok(Value::Bool(l != r)),
                                    Operator::LessThan => Ok(Value::Bool(l < r)),
                                    Operator::LessThanEqual => Ok(Value::Bool(l <= r)),
                                    Operator::GreaterThan => Ok(Value::Bool(l > r)),
                                    Operator::GreaterThanEqual => Ok(Value::Bool(l >= r)),
                                    _ => panic!("unsupported operation (node_id={})", node_ref.id),
                                }
                            }
                            Value::Bool(l) => {
                                let r = right.as_bool();
                                match binary_expr.operator {
                                    Operator::Equal => Ok(Value::Bool(l == r)),
                                    Operator::NotEqual => Ok(Value::Bool(l != r)),
                                    Operator::LessThan => Ok(Value::Bool(l < r)),
                                    Operator::LessThanEqual => Ok(Value::Bool(l <= r)),
                                    Operator::GreaterThan => Ok(Value::Bool(l > r)),
                                    Operator::GreaterThanEqual => Ok(Value::Bool(l >= r)),
                                    _ => panic!("unsupported operation (node_id={})", node_ref.id),
                                }
                            }
                            Value::NoneValue => {
                                panic!("invalid operation (node_id={})", node_ref.id)
                            }
                            Value::Function(_) => {
                                Err(RuntimeError::new(
                                    format!("function is not comparable").as_str()
                                ))
                            }
                        }
                    }
                    Type::Number => { // arithmetic operation
                        let left = self.eval_expr(binary_expr.left, stack)?.as_number();
                        let right = self.eval_expr(binary_expr.right, stack)?.as_number();
                        match binary_expr.operator {
                            Operator::Add => match left.checked_add(right) {
                                Some(x) => Ok(Value::Number(x)),
                                None => Err(RuntimeError::new("add operation overflowed")),
                            }
                            Operator::Sub => match left.checked_sub(right) {
                                Some(x) => Ok(Value::Number(x)),
                                None => Err(RuntimeError::new("sub operation overflowed")),
                            }
                            Operator::Mult => match left.checked_mul(right) {
                                Some(x) => Ok(Value::Number(x)),
                                None => Err(RuntimeError::new("mult operation overflowed")),
                            }
                            Operator::Div => match left.checked_div(right) {
                                Some(x) => Ok(Value::Number(x)),
                                None => Err(RuntimeError::new("div operation overflowed")),
                            }
                            Operator::Mod => match left.checked_rem(right) {
                                Some(x) => Ok(Value::Number(x)),
                                None => Err(RuntimeError::new("mod operation overflowed")),
                            }
                            _ => panic!("unsupported operation"),
                        }
                    }
                    Type::Void => panic!("unexpected type: void"),
                    Type::Function => panic!("unexpected type: function"),
                }
            }
            graph::Node::CallExpr(call_expr) => {
                let callee_node = match call_expr.callee.get(self.source) {
                    graph::Node::Reference(reference) => reference.dest,
                    _ => panic!("callee is invalid (id={})", call_expr.callee.id),
                };
                let callee = match callee_node.get(self.source) {
                    graph::Node::FunctionDeclaration(func) => func,
                    _ => panic!("callee is invalid (id={})", callee_node.id),
                };
                stack.push_frame();
                let mut result = None;
                match &callee.body {
                    Some(graph::FunctionBody::Statements(body)) => {
                        for i in 0..callee.params.len() {
                            let param_node = &callee.params[i];
                            let arg_node = &call_expr.args[i];
                            let arg_symbol = self.eval_expr(*arg_node, stack)?;
                            stack.set_symbol(param_node.id, arg_symbol);
                        }
                        match self.exec_block(body, stack)? {
                            StatementResult::Break => {
                                return Err(RuntimeError::new(
                                    "break target is missing",
                                ));
                            }
                            StatementResult::ReturnWith(value) => {
                                result = Some(value);
                            }
                            _ => {}
                        }
                    }
                    Some(graph::FunctionBody::NativeCode) => {
                        let mut args = Vec::new();
                        for i in 0..callee.params.len() {
                            let arg_node = &call_expr.args[i];
                            let arg_symbol = self.eval_expr(*arg_node, stack)?;
                            args.push(arg_symbol);
                        }
                        if call_expr.args.len() != callee.params.len() {
                            return Err(RuntimeError::new("parameters count error"));
                        }
                        // TODO: improve builtin
                        if &callee.identifier == "print_num" {
                            builtin::print_num(&args)?;
                        } else if &callee.identifier == "print_lf" {
                            builtin::print_lf(&args)?;
                        } else if &callee.identifier == "assert_eq" {
                            builtin::assert_eq(&args)?;
                        } else {
                            return Err(RuntimeError::new("unknown native function"));
                        }
                    }
                    None => panic!("function `{}` is not defined (node_id={})", callee.identifier, call_expr.callee.id),
                }
                stack.pop_frame();
                let value = match result {
                    Some(x) => x,
                    None => Value::NoneValue,
                };
                Ok(value)
            }
            graph::Node::FuncParam(_) => {
                match stack.get_symbol(node_ref.id) { // TODO: check
                    Some(x) => Ok(x.clone()),
                    None => panic!("symbol not found (node_id={})", node_ref.id),
                }
            }
            graph::Node::FunctionDeclaration(_)
            | graph::Node::VariableDeclaration(_)
            | graph::Node::ReturnStatement(_)
            | graph::Node::BreakStatement(_)
            | graph::Node::Assignment(_)
            | graph::Node::IfStatement(_)
            | graph::Node::LoopStatement(_) => {
                panic!("Failed to evaluate the expression: unsupported node (node_id={})", node_ref.id);
            }
        }
    }
}

use crate::ast::AssignmentMode;
use crate::builtin::{
    self,
    BuiltinRuntime,
};
use crate::hir::{
    ArithmeticOperator,
    FunctionBody,
    LiteralValue,
    LogicalBinaryOperator,
    LogicalUnaryOperator,
    Node,
    NodeId,
    RelationalOperator,
    Signature,
    SymbolTable,
    Type,
};
use crate::RuntimeError;
use std::collections::BTreeMap;

enum StatementResult {
    None,
    Break,
    Return,
    ReturnWith(Value),
}

/// evaluated value
#[derive(Debug, Clone)]
pub(crate) enum Value {
    NoneValue,
    Number(i64),
    Bool(bool),
    String(String),
    Function(NodeId),
}

impl Value {
    pub(crate) fn get_type(&self) -> Type {
        match self {
            Value::Number(_) => Type::Number,
            Value::Bool(_) => Type::Bool,
            Value::String(_) => Type::String,
            Value::Function(_) => panic!("get type error"),
            Value::NoneValue => panic!("get type error"),
        }
    }

    pub(crate) fn as_number(&self) -> i64 {
        match self {
            &Value::Number(value) => value,
            _ => panic!("type mismatched. expected `number`, found `{}`", self.get_type().get_name()),
        }
    }

    pub(crate) fn as_bool(&self) -> bool {
        match self {
            &Value::Bool(value) => value,
            _ => panic!("type mismatched. expected `bool`, found `{}`", self.get_type().get_name()),
        }
    }

    pub(crate) fn as_string(&self) -> &str {
        match &self {
            Value::String(value) => value,
            _ => panic!("type mismatched. expected `string`, found `{}`", self.get_type().get_name()),
        }
    }
}

pub(crate) struct Env {
    frames: Vec<EnvFrame>,
    trace: bool,
}

impl Env {
    pub(crate) fn new(trace: bool) -> Self {
        Self {
            frames: vec![EnvFrame::new()],
            trace,
        }
    }

    pub(crate) fn push_frame(&mut self) {
        if self.trace { println!("push_frame"); }
        self.frames.insert(0, EnvFrame::new());
    }

    pub(crate) fn pop_frame(&mut self) {
        if self.trace { println!("pop_frame"); }
        if self.frames.len() == 1 {
            panic!("Left the root frame.");
        }
        self.frames.remove(0);
    }

    pub(crate) fn set_symbol(&mut self, node_id: NodeId, value: Value) {
        if self.trace { println!("set_symbol (node_id: [{}], value: {:?})", node_id, value); }
        match self.frames.get_mut(0) {
            Some(frame) => {
                frame.table.insert(node_id, value);
            }
            None => panic!("frame not found"),
        }
    }

    pub(crate) fn get_symbol(&self, node_id: NodeId) -> Option<&Value> {
        if self.trace { println!("get_symbol [{}]", node_id); }
        match self.frames.get(0) {
            Some(frame) => frame.table.get(&node_id),
            None => panic!("frame not found"),
        }
    }
}

#[derive(Debug)]
struct EnvFrame {
    table: BTreeMap<NodeId, Value>,
}

impl EnvFrame {
    fn new() -> Self {
        Self {
            table: BTreeMap::new(),
        }
    }
}

pub(crate) struct HirRunner<'a> {
    source: &'a BTreeMap<NodeId, Node>,
    symbol_table: &'a SymbolTable,
    trace: bool,
    builtins: BuiltinRuntime,
}

impl<'a> HirRunner<'a> {
    pub(crate) fn new(source: &'a BTreeMap<NodeId, Node>, symbol_table: &'a SymbolTable, trace: bool) -> Self {
        Self {
            source,
            symbol_table,
            trace,
            builtins: builtin::make_runtime(),
        }
    }

    fn resolve_node(&self, node_id: NodeId) -> NodeId {
        match node_id.get(self.source) {
            Node::Reference(reference) => self.resolve_node(reference.dest),
            _ => node_id,
        }
    }

    pub(crate) fn run(&self, hir_code: &Vec<NodeId>, env: &mut Env) -> Result<(), RuntimeError> {
        for &node_id in hir_code.iter() {
            self.exec_statement(node_id, env)?;
        }
        Ok(())
    }

    fn exec_block(&self, statements: &Vec<NodeId>, env: &mut Env) -> Result<StatementResult, RuntimeError> {
        if self.trace { println!("enter block"); }
        let mut result = StatementResult::None;
        for &node_id in statements.iter() {
            result = self.exec_statement(node_id, env)?;
            match result {
                StatementResult::None => {}
                StatementResult::Break
                | StatementResult::Return
                | StatementResult::ReturnWith(_) => {
                    break;
                }
            }
        }
        if self.trace { println!("leave block"); }
        Ok(result)
    }

    // Execute a statement.
    fn exec_statement(
        &self,
        node_id: NodeId,
        env: &mut Env,
    ) -> Result<StatementResult, RuntimeError> {
        if self.trace { println!("enter statement [{}]", node_id); }
        let result = match node_id.get(self.source) {
            Node::Declaration(decl) => {
                // TODO: check duplicate
                match decl.signature {
                    Signature::FunctionSignature(_) => {
                        env.set_symbol(node_id, Value::Function(node_id));
                    }
                    Signature::VariableSignature(_) => {
                        match self.symbol_table.get(node_id).body {
                            Some(body) => {
                                let value = self.eval_expr(body, env)?;
                                env.set_symbol(node_id, value);
                            }
                            None => {} // variable is not defined yet
                        }
                    }
                    Signature::StructSignature(_) => {
                        todo!();
                    }
                }
                Ok(StatementResult::None)
            }
            Node::ReturnStatement(statement) => {
                match &statement.body {
                    Some(expr) => {
                        let value = self.eval_expr(*expr, env)?;
                        Ok(StatementResult::ReturnWith(value))
                    }
                    None => {
                        Ok(StatementResult::Return)
                    }
                }
            }
            Node::BreakStatement(_) => Ok(StatementResult::Break),
            Node::Assignment(statement) => {
                let curr_value = self.eval_expr(statement.dest, env)?;
                match statement.mode {
                    AssignmentMode::Assign => {
                        let dest_id = self.resolve_node(statement.dest);
                        let value = self.eval_expr(statement.body, env)?;
                        env.set_symbol(dest_id, value);
                    }
                    AssignmentMode::AddAssign => {
                        let dest_id = self.resolve_node(statement.dest);
                        let restored_value = curr_value.as_number();
                        let body_value = self.eval_expr(statement.body, env)?.as_number();
                        let value = match restored_value.checked_add(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("add operation overflowed")),
                        };
                        env.set_symbol(dest_id, Value::Number(value));
                    }
                    AssignmentMode::SubAssign => {
                        let dest_id = self.resolve_node(statement.dest);
                        let restored_value = curr_value.as_number();
                        let body_value = self.eval_expr(statement.body, env)?.as_number();
                        let value = match restored_value.checked_sub(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("sub operation overflowed")),
                        };
                        env.set_symbol(dest_id, Value::Number(value));
                    }
                    AssignmentMode::MultAssign => {
                        let dest_id = self.resolve_node(statement.dest);
                        let restored_value = curr_value.as_number();
                        let body_value = self.eval_expr(statement.body, env)?.as_number();
                        let value = match restored_value.checked_mul(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("mult operation overflowed")),
                        };
                        env.set_symbol(dest_id, Value::Number(value));
                    }
                    AssignmentMode::DivAssign => {
                        let dest_id = self.resolve_node(statement.dest);
                        let restored_value = curr_value.as_number();
                        let body_value = self.eval_expr(statement.body, env)?.as_number();
                        let value = match restored_value.checked_div(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("div operation overflowed")),
                        };
                        env.set_symbol(dest_id, Value::Number(value));
                    }
                    AssignmentMode::ModAssign => {
                        let dest_id = self.resolve_node(statement.dest);
                        let restored_value = curr_value.as_number();
                        let body_value = self.eval_expr(statement.body, env)?.as_number();
                        let value = match restored_value.checked_rem(body_value) {
                            Some(x) => x,
                            None => return Err(RuntimeError::new("mod operation overflowed")),
                        };
                        env.set_symbol(dest_id, Value::Number(value));
                    }
                }
                Ok(StatementResult::None)
            }
            Node::IfStatement(statement) => {
                let condition = self.eval_expr(statement.condition, env)?.as_bool();
                let block = if condition {
                    &statement.then_block
                } else {
                    &statement.else_block
                };
                self.exec_block(block, env)
            }
            Node::LoopStatement(statement) => {
                let mut result;
                loop {
                    result = self.exec_block(&statement.body, env)?;
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
            Node::Reference(_)
            | Node::Literal(_)
            | Node::RelationalOp(_)
            | Node::LogicalBinaryOp(_)
            | Node::ArithmeticOp(_)
            | Node::LogicalUnaryOp(_)
            | Node::CallExpr(_) => {
                self.eval_expr(node_id, env)?;
                Ok(StatementResult::None)
            }
            Node::Function(_)
            | Node::Variable(_)
            | Node::FuncParam(_)
            | Node::StructField(_)
            | Node::StructInit(_)
            | Node::StructInitField(_) => {
                panic!("Failed to execute the statement: unsupported node (node_id={})", node_id);
            }
        };
        if self.trace { println!("leave statement [{}]", node_id); }
        result
    }

    /// Generate a value by evaluating an expression.
    fn eval_expr(
        &self,
        node_id: NodeId,
        env: &mut Env,
    ) -> Result<Value, RuntimeError> {
        if self.trace { println!("enter expression [{}]", node_id); }
        let result = match node_id.get(self.source) {
            Node::Variable(variable) => { // variable of initial value
                Ok(self.eval_expr(variable.content, env)?)
            }
            Node::Reference(reference) => {
                let dest_id = self.resolve_node(reference.dest);
                match env.get_symbol(dest_id) {
                    Some(x) => Ok(x.clone()),
                    None => panic!("symbol not found (node_id={}, dest_id={})", node_id, dest_id),
                }
            }
            Node::Literal(literal) => {
                match &literal.value {
                    LiteralValue::Number(n) => Ok(Value::Number(*n)),
                    LiteralValue::Bool(value) => Ok(Value::Bool(*value)),
                    LiteralValue::String(value) => Ok(Value::String(value.clone())),
                }
            }
            Node::RelationalOp(expr) => {
                let left = self.eval_expr(expr.left, env)?;
                let right = self.eval_expr(expr.right, env)?;
                match expr.relation_type {
                    Type::Number => {
                        let left = left.as_number();
                        let right = right.as_number();
                        match expr.operator {
                            RelationalOperator::Equal => Ok(Value::Bool(left == right)),
                            RelationalOperator::NotEqual => Ok(Value::Bool(left != right)),
                            RelationalOperator::LessThan => Ok(Value::Bool(left < right)),
                            RelationalOperator::LessThanEqual => Ok(Value::Bool(left <= right)),
                            RelationalOperator::GreaterThan => Ok(Value::Bool(left > right)),
                            RelationalOperator::GreaterThanEqual => Ok(Value::Bool(left >= right)),
                        }
                    }
                    Type::Bool => {
                        let left = left.as_bool();
                        let right = right.as_bool();
                        match expr.operator {
                            RelationalOperator::Equal => Ok(Value::Bool(left == right)),
                            RelationalOperator::NotEqual => Ok(Value::Bool(left != right)),
                            RelationalOperator::LessThan => Ok(Value::Bool(left < right)),
                            RelationalOperator::LessThanEqual => Ok(Value::Bool(left <= right)),
                            RelationalOperator::GreaterThan => Ok(Value::Bool(left > right)),
                            RelationalOperator::GreaterThanEqual => Ok(Value::Bool(left >= right)),
                        }
                    }
                    Type::Function
                    | Type::String
                    | Type::Void => {
                        panic!("unsupported operation (node_id={})", node_id);
                    }
                }
            }
            Node::LogicalBinaryOp(expr) => {
                let left = self.eval_expr(expr.left, env)?.as_bool();
                let right = self.eval_expr(expr.right, env)?.as_bool();
                match expr.operator {
                    LogicalBinaryOperator::And => Ok(Value::Bool(left && right)),
                    LogicalBinaryOperator::Or => Ok(Value::Bool(left || right)),
                }
            }
            Node::ArithmeticOp(expr) => {
                let left = self.eval_expr(expr.left, env)?.as_number();
                let right = self.eval_expr(expr.right, env)?.as_number();
                match expr.operator {
                    ArithmeticOperator::Add => match left.checked_add(right) {
                        Some(x) => Ok(Value::Number(x)),
                        None => Err(RuntimeError::new("add operation overflowed")),
                    }
                    ArithmeticOperator::Sub => match left.checked_sub(right) {
                        Some(x) => Ok(Value::Number(x)),
                        None => Err(RuntimeError::new("sub operation overflowed")),
                    }
                    ArithmeticOperator::Mult => match left.checked_mul(right) {
                        Some(x) => Ok(Value::Number(x)),
                        None => Err(RuntimeError::new("mult operation overflowed")),
                    }
                    ArithmeticOperator::Div => match left.checked_div(right) {
                        Some(x) => Ok(Value::Number(x)),
                        None => Err(RuntimeError::new("div operation overflowed")),
                    }
                    ArithmeticOperator::Mod => match left.checked_rem(right) {
                        Some(x) => Ok(Value::Number(x)),
                        None => Err(RuntimeError::new("mod operation overflowed")),
                    }
                }
            }
            Node::LogicalUnaryOp(op) => {
                let expr = self.eval_expr(op.expr, env)?.as_bool();
                match op.operator {
                    LogicalUnaryOperator::Not => Ok(Value::Bool(!expr)),
                }
            }
            Node::CallExpr(call_expr) => {
                let callee_id = self.resolve_node(call_expr.callee);
                let callee = callee_id.get(self.source).as_decl().unwrap();
                let signature = callee.signature.as_function_signature().unwrap();
                let func = match self.symbol_table.get(callee_id).body {
                    Some(x) => x.get(self.source).as_function().unwrap(),
                    None => panic!("function `{}` is not defined (node_id={})", callee.identifier, call_expr.callee),
                };
                let mut args = Vec::new();
                for &arg_id in call_expr.args.iter() {
                    let arg_value = self.eval_expr(arg_id, env)?;
                    args.push(arg_value);
                }
                env.push_frame();
                let mut result = None;
                match &func.content {
                    FunctionBody::Statements(body) => {
                        for i in 0..signature.params.len() {
                            let param_addr = signature.params[i];
                            let arg_value = args[i].clone();
                            env.set_symbol(param_addr, arg_value);
                        }
                        match self.exec_block(&body, env)? {
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
                    FunctionBody::NativeCode => {
                        result = Some(self.builtins.call(&callee.identifier, &args)?);
                    }
                }
                env.pop_frame();
                let value = match result {
                    Some(x) => x,
                    None => Value::NoneValue,
                };
                Ok(value)
            }
            Node::Function(_) => panic!("function object unsupported (node_id={})", node_id),
            Node::FuncParam(_)
            | Node::StructField(_)
            | Node::StructInit(_)
            | Node::StructInitField(_)
            | Node::Declaration(_)
            | Node::ReturnStatement(_)
            | Node::BreakStatement(_)
            | Node::Assignment(_)
            | Node::IfStatement(_)
            | Node::LoopStatement(_) => {
                panic!("Failed to evaluate the expression: unsupported node (node_id={})", node_id);
            }
        };
        if self.trace { println!("leave expression [{}]", node_id); }
        result
    }
}

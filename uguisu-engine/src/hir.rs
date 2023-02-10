use std::collections::BTreeMap;
use crate::ast;

#[derive(Debug)]
pub enum Node {
    // statement
    Declaration(Declaration),
    BreakStatement(BreakStatement),
    ReturnStatement(ReturnStatement),
    Assignment(Assignment),
    IfStatement(IfStatement),
    LoopStatement(LoopStatement),
    // expression
    Function(Function),
    Variable(Variable),
    Reference(Reference),
    Literal(Literal),
    RelationalOp(RelationalOp),
    LogicalBinaryOp(LogicalBinaryOp),
    ArithmeticOp(ArithmeticOp),
    LogicalUnaryOp(LogicalUnaryOp),
    CallExpr(CallExpr),
    FuncParam(FuncParam),
}

impl Node {
    pub fn get_name(&self) -> &str {
        match self {
            Node::Declaration(_) => "Declaration",
            Node::BreakStatement(_) => "BreakStatement",
            Node::ReturnStatement(_) => "ReturnStatement",
            Node::Assignment(_) => "Assignment",
            Node::IfStatement(_) => "IfStatement",
            Node::LoopStatement(_) => "LoopStatement",
            Node::Function(_) => "Function",
            Node::Variable(_) => "Variable",
            Node::Reference(_) => "Reference",
            Node::Literal(_) => "Literal",
            Node::RelationalOp(_) => "RelationalOp",
            Node::LogicalBinaryOp(_) => "LogicalBinaryOp",
            Node::ArithmeticOp(_) => "ArithmeticOp",
            Node::LogicalUnaryOp(_) => "LogicalUnaryOp",
            Node::CallExpr(_) => "CallExpr",
            Node::FuncParam(_) => "FuncParam",
        }
    }

    pub fn new_declaration(
        identifier: String,
        signature: Signature,
    ) -> Self {
        Node::Declaration(Declaration {
            identifier,
            signature,
        })
    }

    pub fn new_break_statement() -> Self {
        Node::BreakStatement(BreakStatement {})
    }

    pub fn new_return_statement(body: Option<NodeRef>) -> Self {
        Node::ReturnStatement(ReturnStatement {
            body,
        })
    }

    pub fn new_assignment(
        dest: NodeRef,
        body: NodeRef,
        mode: ast::AssignmentMode,
    ) -> Self {
        Node::Assignment(Assignment {
            dest,
            body,
            mode,
        })
    }

    pub fn new_if_statement(
        condition: NodeRef,
        then_block: Vec<NodeRef>,
        else_block: Vec<NodeRef>,
    ) -> Self {
        Node::IfStatement(IfStatement {
            condition,
            then_block,
            else_block,
        })
    }

    pub fn new_loop_statement(body: Vec<NodeRef>) -> Self {
        Node::LoopStatement(LoopStatement {
            body,
        })
    }

    pub fn new_function(
        params: Vec<NodeRef>,
        ret_ty: Type,
        content: FunctionBody,
    ) -> Self {
        Node::Function(Function {
            params,
            ret_ty,
            content,
        })
    }

    pub fn new_variable(content: NodeRef) -> Self {
        Node::Variable(Variable {
            content,
        })
    }

    pub fn new_reference(dest: NodeRef) -> Self {
        Node::Reference(Reference {
            dest,
        })
    }

    pub fn new_literal(value: LiteralValue) -> Self {
        Node::Literal(Literal {
            value,
        })
    }

    pub fn new_relational_op(
        operator: RelationalOperator,
        relation_type: Type,
        left: NodeRef,
        right: NodeRef,
    ) -> Self {
        Node::RelationalOp(RelationalOp {
            operator,
            relation_type,
            left,
            right,
        })
    }

    pub fn new_logical_binary_op(
        operator: LogicalBinaryOperator,
        left: NodeRef,
        right: NodeRef,
    ) -> Self {
        Node::LogicalBinaryOp(LogicalBinaryOp {
            operator,
            left,
            right,
        })
    }

    pub fn new_arithmetic_op(
        operator: ArithmeticOperator,
        left: NodeRef,
        right: NodeRef,
    ) -> Self {
        Node::ArithmeticOp(ArithmeticOp {
            operator,
            left,
            right,
        })
    }

    pub fn new_logical_unary_op(
        operator: LogicalUnaryOperator,
        expr: NodeRef,
    ) -> Self {
        Node::LogicalUnaryOp(LogicalUnaryOp {
            operator,
            expr,
        })
    }

    pub fn new_call_expr(
        callee: NodeRef,
        args: Vec<NodeRef>,
    ) -> Self {
        Node::CallExpr(CallExpr {
            callee,
            args,
        })
    }

    pub fn new_func_param(identifier: String) -> Self {
        Node::FuncParam(FuncParam {
            identifier,
            // param_index,
        })
    }

    pub fn as_function(&self) -> Result<&Function, String> {
        match self {
            Node::Function(x) => Ok(x),
            _ => Err("function expected".to_owned()),
        }
    }

    pub fn as_decl(&self) -> Result<&Declaration, String> {
        match self {
            Node::Declaration(x) => Ok(x),
            _ => Err("declaration expected".to_owned()),
        }
    }

    pub fn as_func_param(&self) -> Result<&FuncParam, String> {
        match self {
            Node::FuncParam(x) => Ok(x),
            _ => Err("function parameter expected".to_owned()),
        }
    }
}

pub type NodeId = usize;

#[derive(Debug, Clone, Copy)]
pub struct NodeRef {
    pub id: NodeId,
}

impl NodeRef {
    pub fn new(node_id: NodeId) -> Self {
        Self { id: node_id }
    }

    pub fn get<'a>(&self, node_map: &'a BTreeMap<NodeId, Node>) -> &'a Node {
        &node_map[&self.id]
    }
}

#[derive(Debug)]
pub struct Declaration {
    pub identifier: String,
    pub signature: Signature,
    //pub ty: Option<Type>,
}

#[derive(Debug)]
pub enum Signature {
    FunctionSignature(FunctionSignature),
    VariableSignature(VariableSignature),
}

impl Signature {
    pub fn as_function_signature(&self) -> Result<&FunctionSignature, String> {
        match self {
            Signature::FunctionSignature(x) => Ok(x),
            _ => Err("function signature expected".to_owned()),
        }
    }
}

#[derive(Debug)]
pub struct FunctionSignature {
    /// FuncParam
    pub params: Vec<NodeRef>,
    pub ret_ty: Type,
}

#[derive(Debug)]
pub struct VariableSignature {
    pub specified_ty: Option<Type>,
}

#[derive(Debug)]
pub struct BreakStatement {
}

#[derive(Debug)]
pub struct ReturnStatement {
    /// Expression
    pub body: Option<NodeRef>,
}

#[derive(Debug)]
pub struct Assignment {
    /// Reference
    pub dest: NodeRef,
    /// Expression
    pub body: NodeRef,
    pub mode: ast::AssignmentMode,
}

#[derive(Debug)]
pub struct IfStatement {
    /// Expression
    pub condition: NodeRef,
    /// Statement
    pub then_block: Vec<NodeRef>,
    /// Statement
    pub else_block: Vec<NodeRef>,
}

#[derive(Debug)]
pub struct LoopStatement {
    /// Statement
    pub body: Vec<NodeRef>,
}

#[derive(Debug)]
pub struct Function {
    /// FuncParam
    pub params: Vec<NodeRef>,
    pub ret_ty: Type,
    pub content: FunctionBody,
}

#[derive(Debug, Clone)]
pub struct FuncParam {
    pub identifier: String,
    // pub param_index: usize,
}

#[derive(Debug)]
pub enum FunctionBody {
    /// Statement
    Statements(Vec<NodeRef>),
    NativeCode,
}

#[derive(Debug)]
pub struct Variable {
    /// Expression
    pub content: NodeRef,
}

#[derive(Debug)]
pub struct Reference {
    /// Declaration
    pub dest: NodeRef,
}

#[derive(Debug)]
pub struct Literal {
    pub value: LiteralValue,
}

#[derive(Debug)]
pub enum LiteralValue {
    Number(i64),
    Bool(bool),
}

#[derive(Debug)]
pub struct RelationalOp {
    pub operator: RelationalOperator,
    pub relation_type: Type,
    /// Expression
    pub left: NodeRef,
    /// Expression
    pub right: NodeRef,
}

#[derive(Debug)]
pub enum RelationalOperator {
    Equal,
    NotEqual,
    GreaterThan,
    GreaterThanEqual,
    LessThan,
    LessThanEqual,
}

#[derive(Debug)]
pub struct LogicalBinaryOp {
    pub operator: LogicalBinaryOperator,
    /// Expression
    pub left: NodeRef,
    /// Expression
    pub right: NodeRef,
}

#[derive(Debug)]
pub enum LogicalBinaryOperator {
    And,
    Or,
}

#[derive(Debug)]
pub struct ArithmeticOp {
    pub operator: ArithmeticOperator,
    /// Expression
    pub left: NodeRef,
    /// Expression
    pub right: NodeRef,
}

#[derive(Debug)]
pub enum ArithmeticOperator {
    Add,
    Sub,
    Mult,
    Div,
    Mod,
}

#[derive(Debug)]
pub struct LogicalUnaryOp {
    pub operator: LogicalUnaryOperator,
    /// Expression
    pub expr: NodeRef,
}

#[derive(Debug)]
pub enum LogicalUnaryOperator {
    Not,
}

#[derive(Debug)]
pub struct CallExpr {
    /// Reference (expects: Reference -> Declaration -> Function)
    pub callee: NodeRef,
    /// Expression
    pub args: Vec<NodeRef>,
}

pub(crate) fn show_map(node_map: &BTreeMap<NodeId, Node>, symbol_table: &SymbolTable) {
    for i in 0..node_map.len() {
        show_node(NodeRef::new(i), node_map, symbol_table);
    }
}

pub(crate) fn show_node(node_ref: NodeRef, node_map: &BTreeMap<NodeId, Node>, symbol_table: &SymbolTable) {
    let node = node_ref.get(node_map);
    let name = node.get_name();
    match symbol_table.get(node_ref).pos {
        Some((line, column)) => println!("[{}] {} ({}:{}) {{", node_ref.id, name, line, column),
        None => println!("[{}] {} (no location) {{", node_ref.id, name),
    }
    match node {
        Node::Declaration(decl) => {
            println!("  identifier: \"{}\"", decl.identifier);
            match &decl.signature {
                Signature::FunctionSignature(signature) => {
                    println!("  signature(FunctionSignature): {{");
                    println!("    params: {{");
                    for param in signature.params.iter() {
                        println!("      [{}]", param.id);
                    }
                    println!("    }}");
                    println!("    return_type: {:?}", signature.ret_ty);
                    println!("  }}");
                }
                Signature::VariableSignature(signature) => {
                    println!("  signature(VariableSignature): {{");
                    match &signature.specified_ty {
                        Some(specified_ty) => {
                            println!("    specified_type: {:?}", specified_ty);
                        }
                        None => {
                            println!("    specified_type: (None)");
                        }
                    }
                    println!("  }}");
                }
            }
        }
        Node::Function(func) => {
            println!("  params: {{");
            for param in func.params.iter() {
                println!("    [{}]", param.id);
            }
            println!("  }}");
            println!("  return_type: {:?}", func.ret_ty);
            match &func.content {
                FunctionBody::Statements(body) => {
                    println!("  body: (statements) {{");
                    for item in body.iter() {
                        println!("    [{}]", item.id);
                    }
                    println!("  }}");
                }
                FunctionBody::NativeCode => {
                    println!("  body: (native code)");
                }
            }
        }
        Node::Variable(variable) => {
            println!("  content: {{");
            println!("    [{}]", variable.content.id);
            println!("  }}");
        }
        Node::BreakStatement(_) => {}
        Node::ReturnStatement(node) => {
            match node.body {
                Some(x) => {
                    println!("  expr: {{");
                    println!("    [{}]", x.id);
                    println!("  }}");
                }
                None => {
                    println!("  expr: (None)");
                }
            }
        }
        Node::Assignment(statement) => {
            println!("  dest: {{");
            println!("    [{}]", statement.dest.id);
            println!("  }}");
            println!("  body: {{");
            println!("    [{}]", statement.body.id);
            println!("  }}");
        }
        Node::IfStatement(if_statement) => {
            println!("  condition: {{");
            println!("    [{}]", if_statement.condition.id);
            println!("  }}");
            println!("  then_block: {{");
            for item in if_statement.then_block.iter() {
                println!("    [{}]", item.id);
            }
            println!("  }}");
            println!("  else_block: {{");
            for item in if_statement.else_block.iter() {
                println!("    [{}]", item.id);
            }
            println!("  }}");
        }
        Node::LoopStatement(statement) => {
            println!("  body: {{");
            for item in statement.body.iter() {
                println!("    [{}]", item.id);
            }
            println!("  }}");
        }
        Node::Reference(x) => {
            println!("  dest: {{");
            println!("    [{}]", x.dest.id);
            println!("  }}");
        }
        Node::Literal(literal) => {
            println!("  value: {:?}", literal.value);
        }
        Node::RelationalOp(expr) => {
            println!("  operator: {:?}", expr.operator);
            println!("  left: {{");
            println!("    [{}]", expr.left.id);
            println!("  }}");
            println!("  right: {{");
            println!("    [{}]", expr.right.id);
            println!("  }}");
        },
        Node::LogicalBinaryOp(expr) => {
            println!("  operator: {:?}", expr.operator);
            println!("  left: {{");
            println!("    [{}]", expr.left.id);
            println!("  }}");
            println!("  right: {{");
            println!("    [{}]", expr.right.id);
            println!("  }}");
        },
        Node::ArithmeticOp(expr) => {
            println!("  operator: {:?}", expr.operator);
            println!("  left: {{");
            println!("    [{}]", expr.left.id);
            println!("  }}");
            println!("  right: {{");
            println!("    [{}]", expr.right.id);
            println!("  }}");
        },
        Node::LogicalUnaryOp(op) => {
            println!("  operator: {:?}", op.operator);
            println!("  expr: {{");
            println!("    [{}]", op.expr.id);
            println!("  }}");
        },
        Node::CallExpr(call_expr) => {
            println!("  callee: {{");
            println!("    [{}]", call_expr.callee.id);
            println!("  }}");
            println!("  args: {{");
            for arg in call_expr.args.iter() {
                println!("    [{}]", arg.id);
            }
            println!("  }}");
        }
        Node::FuncParam(func_param) => {
            println!("  identifier: \"{}\"", func_param.identifier);
            //println!("  type: {:?}", func_param.ty);
        }
    }
    println!("}}");
}

pub(crate) struct ResolverStack {
    frames: Vec<ResolverFrame>,
    trace: bool,
}

impl ResolverStack {
    pub(crate) fn new(trace: bool) -> Self {
        Self {
            frames: vec![ResolverFrame::new()],
            trace,
        }
    }

    pub(crate) fn is_root_frame(&mut self) -> bool {
        self.frames.len() == 1
    }

    pub(crate) fn push_frame(&mut self) {
        if self.trace { println!("push_frame"); }
        self.frames.insert(0, ResolverFrame::new());
    }

    pub(crate) fn pop_frame(&mut self) {
        if self.trace { println!("pop_frame"); }
        if self.is_root_frame() {
            panic!("Left the root frame.");
        }
        self.frames.remove(0);
    }

    pub(crate) fn set_identifier(&mut self, identifier: &str, node: NodeRef) {
        if self.trace { println!("set_identifier (identifier: \"{}\", node_id: [{}])", identifier, node.id); }
        match self.frames.get_mut(0) {
            Some(frame) => {
                frame.table.insert(identifier.to_string(), node);
            }
            None => panic!("frame not found"),
        }
    }

    pub(crate) fn lookup_identifier(&self, identifier: &str) -> Option<NodeRef> {
        for frame in self.frames.iter() {
            match frame.table.get(identifier) {
                Some(&node) => {
                    if self.trace { println!("lookup_identifier success (identifier: \"{}\", node_id: {})", identifier, node.id); }
                    return Some(node)
                }
                None => {
                    if self.trace { println!("lookup_identifier failure (identifier: \"{}\")", identifier); }
                }
            }
        }
        None
    }
}

struct ResolverFrame {
    table: BTreeMap<String, NodeRef>,
}

impl ResolverFrame {
    fn new() -> Self {
        Self {
            table: BTreeMap::new(),
        }
    }
}

pub struct SymbolTable {
    pub table: BTreeMap<NodeId, SymbolRecord>,
    pub trace: bool,
}

impl SymbolTable {
    pub fn new() -> Self {
        Self {
            table: BTreeMap::new(),
            trace: false,
        }
    }

    pub fn set_trace(&mut self, enabled: bool) {
        self.trace = enabled;
    }

    pub fn new_record(&mut self, node: NodeRef) {
        let record = SymbolRecord {
            ty: None,
            pos: None,
            body: None,
        };
        self.table.insert(node.id, record);
    }

    pub fn set_ty(&mut self, node: NodeRef, ty: Type) {
        if self.trace { println!("set_ty (node_id: [{}], ty: {:?})", node.id, ty); }
        let record = match self.table.get_mut(&node.id) {
            Some(x) => x,
            None => panic!("symbol not found"),
        };
        record.ty = Some(ty);
    }

    pub fn set_pos(&mut self, node: NodeRef, pos: (usize, usize)) {
        if self.trace { println!("set_pos (node_id: [{}], pos: {:?})", node.id, pos); }
        let record = match self.table.get_mut(&node.id) {
            Some(x) => x,
            None => panic!("symbol not found"),
        };
        record.pos = Some(pos);
    }

    pub fn set_body(&mut self, node: NodeRef, body: NodeRef) {
        if self.trace { println!("set_body (node_id: [{}], body: [{}])", node.id, body.id); }
        let record = match self.table.get_mut(&node.id) {
            Some(x) => x,
            None => panic!("symbol not found"),
        };
        record.body = Some(body);
    }

    pub fn get(&self, node: NodeRef) -> &SymbolRecord {
        if self.trace { println!("get (node_id: [{}])", node.id); }
        match self.table.get(&node.id) {
            Some(x) => x,
            None => panic!("symbol not found"),
        }
    }
}

#[derive(Debug)]
pub struct SymbolRecord {
    pub ty: Option<Type>,
    pub pos: Option<(usize, usize)>,
    /// (for Declaration) Variable or Function
    pub body: Option<NodeRef>,
}

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum Type {
    Void,
    Number,
    Bool,
    Function,
}

impl Type {
    pub fn get_name(&self) -> &str {
        match self {
            Type::Void => "void",
            Type::Number => "number",
            Type::Bool => "bool",
            Type::Function => "function",
        }
    }

    pub fn from_identifier(ty_identifier: &str) -> Result<Type, String> {
        match ty_identifier {
            "void" => Err("type `void` is invalid".to_owned()),
            "number" => Ok(Type::Number),
            "bool" => Ok(Type::Bool),
            _ => Err("unknown type name".to_owned()),
        }
    }

    pub fn assert(actual: Type, expected: Type) -> Result<Type, String> {
        if actual == expected {
            Ok(actual)
        } else {
            let message = format!("type mismatched. expected `{}`, found `{}`", expected.get_name(), actual.get_name());
            Err(message)
        }
    }
}

use crate::ast;
use std::collections::BTreeMap;
use std::fmt;

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
    Identifier(Identifier),
    Literal(Literal),
    RelationalOp(RelationalOp),
    LogicalBinaryOp(LogicalBinaryOp),
    ArithmeticOp(ArithmeticOp),
    LogicalUnaryOp(LogicalUnaryOp),
    CallExpr(CallExpr),
    FuncParam(FuncParam),
    StructExpr(StructExpr),
    StructExprField(StructExprField),
    StructDeclField(StructDeclField),
    FieldAccess(FieldAccess),
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
            Node::Identifier(_) => "Identifier",
            Node::Literal(_) => "Literal",
            Node::RelationalOp(_) => "RelationalOp",
            Node::LogicalBinaryOp(_) => "LogicalBinaryOp",
            Node::ArithmeticOp(_) => "ArithmeticOp",
            Node::LogicalUnaryOp(_) => "LogicalUnaryOp",
            Node::CallExpr(_) => "CallExpr",
            Node::FuncParam(_) => "FuncParam",
            Node::StructDeclField(_) => "StructDeclField",
            Node::StructExpr(_) => "StructExpr",
            Node::StructExprField(_) => "StructExprField",
            Node::FieldAccess(_) => "FieldAccess",
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

    pub fn new_return_statement(body: Option<NodeId>) -> Self {
        Node::ReturnStatement(ReturnStatement {
            body,
        })
    }

    pub fn new_assignment(
        dest: NodeId,
        body: NodeId,
        mode: ast::AssignmentMode,
    ) -> Self {
        Node::Assignment(Assignment {
            dest,
            body,
            mode,
        })
    }

    pub fn new_if_statement(
        condition: NodeId,
        then_block: Vec<NodeId>,
        else_block: Vec<NodeId>,
    ) -> Self {
        Node::IfStatement(IfStatement {
            condition,
            then_block,
            else_block,
        })
    }

    pub fn new_loop_statement(body: Vec<NodeId>) -> Self {
        Node::LoopStatement(LoopStatement {
            body,
        })
    }

    pub fn new_function(
        params: Vec<NodeId>,
        ret_ty: Type,
        content: FunctionBody,
    ) -> Self {
        Node::Function(Function {
            params,
            ret_ty,
            content,
        })
    }

    pub fn new_variable(content: NodeId) -> Self {
        Node::Variable(Variable {
            content,
        })
    }

    pub fn new_identifier(dest: NodeId) -> Self {
        Node::Identifier(Identifier {
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
        left: NodeId,
        right: NodeId,
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
        left: NodeId,
        right: NodeId,
    ) -> Self {
        Node::LogicalBinaryOp(LogicalBinaryOp {
            operator,
            left,
            right,
        })
    }

    pub fn new_arithmetic_op(
        operator: ArithmeticOperator,
        left: NodeId,
        right: NodeId,
    ) -> Self {
        Node::ArithmeticOp(ArithmeticOp {
            operator,
            left,
            right,
        })
    }

    pub fn new_logical_unary_op(
        operator: LogicalUnaryOperator,
        expr: NodeId,
    ) -> Self {
        Node::LogicalUnaryOp(LogicalUnaryOp {
            operator,
            expr,
        })
    }

    pub fn new_call_expr(
        callee: NodeId,
        args: Vec<NodeId>,
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

    pub fn new_struct_expr(
        identifier: String,
        fields: BTreeMap<String, NodeId>,
    ) -> Self {
        Node::StructExpr(StructExpr {
            identifier,
            field_table: fields,
        })
    }

    pub fn new_struct_expr_field(body: NodeId) -> Self {
        Node::StructExprField(StructExprField {
            body,
        })
    }

    pub fn new_field_access(identifier: String, target: NodeId) -> Self {
        Node::FieldAccess(FieldAccess {
            identifier,
            target,
        })
    }

    pub fn as_function(&self) -> Result<&Function, String> {
        match self {
            Node::Function(x) => Ok(x),
            _ => Err("function expected".to_owned()),
        }
    }

    pub fn as_variable(&self) -> Result<&Variable, String> {
        match self {
            Node::Variable(x) => Ok(x),
            _ => Err("variable expected".to_owned()),
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

    pub fn as_struct_decl_field(&self) -> Result<&StructDeclField, String> {
        match self {
            Node::StructDeclField(x) => Ok(x),
            _ => Err("struct declaration field expected".to_owned()),
        }
    }

    pub fn as_struct_expr(&self) -> Result<&StructExpr, String> {
        match self {
            Node::StructExpr(x) => Ok(x),
            _ => Err("struct expression expected".to_owned()),
        }
    }

    pub fn as_struct_expr_field(&self) -> Result<&StructExprField, String> {
        match self {
            Node::StructExprField(x) => Ok(x),
            _ => Err("struct expression field expected".to_owned()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct NodeId {
    pub value: usize,
}

impl NodeId {
    pub fn new(value: usize) -> Self {
        Self {
            value,
        }
    }

    pub fn get<'a>(&self, node_map: &'a BTreeMap<NodeId, Node>) -> &'a Node {
        match node_map.get(self) {
            Some(x) => x,
            None => panic!("node not found"),
        }
    }
}

impl fmt::Display for NodeId {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.value)
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
    StructSignature(StructSignature),
}

impl Signature {
    pub fn as_variable_signature(&self) -> Result<&VariableSignature, String> {
        match self {
            Signature::VariableSignature(x) => Ok(x),
            _ => Err("variable signature expected".to_owned()),
        }
    }

    pub fn as_function_signature(&self) -> Result<&FunctionSignature, String> {
        match self {
            Signature::FunctionSignature(x) => Ok(x),
            _ => Err("function signature expected".to_owned()),
        }
    }

    pub fn as_struct_signature(&self) -> Result<&StructSignature, String> {
        match self {
            Signature::StructSignature(x) => Ok(x),
            _ => Err("struct signature expected".to_owned()),
        }
    }
}

#[derive(Debug)]
pub struct FunctionSignature {
    /// FuncParam
    pub params: Vec<NodeId>,
    pub ret_ty: Type,
}

#[derive(Debug)]
pub struct VariableSignature {
    pub specified_ty: Option<Type>,
}

#[derive(Debug)]
pub struct StructSignature {
    /// StructDeclField
    pub field_table: BTreeMap<String, NodeId>,
}

#[derive(Debug, Clone)]
pub struct StructDeclField {
}

#[derive(Debug, Clone)]
pub struct FieldAccess {
    pub identifier: String,
    pub target: NodeId,
}

#[derive(Debug)]
pub struct BreakStatement {
}

#[derive(Debug)]
pub struct ReturnStatement {
    /// Expression
    pub body: Option<NodeId>,
}

#[derive(Debug)]
pub struct Assignment {
    /// Identifier
    pub dest: NodeId,
    /// Expression
    pub body: NodeId,
    pub mode: ast::AssignmentMode,
}

#[derive(Debug)]
pub struct IfStatement {
    /// Expression
    pub condition: NodeId,
    /// Statement
    pub then_block: Vec<NodeId>,
    /// Statement
    pub else_block: Vec<NodeId>,
}

#[derive(Debug)]
pub struct LoopStatement {
    /// Statement
    pub body: Vec<NodeId>,
}

#[derive(Debug)]
pub struct Function {
    /// FuncParam
    pub params: Vec<NodeId>,
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
    Statements(Vec<NodeId>),
    NativeCode,
}

#[derive(Debug)]
pub struct Variable {
    /// Expression
    pub content: NodeId,
}

#[derive(Debug)]
pub struct Identifier {
    /// Declaration
    pub dest: NodeId,
}

#[derive(Debug)]
pub struct Literal {
    pub value: LiteralValue,
}

#[derive(Debug)]
pub enum LiteralValue {
    Number(i64),
    Bool(bool),
    String(String),
}

#[derive(Debug)]
pub struct RelationalOp {
    pub operator: RelationalOperator,
    pub relation_type: Type,
    /// Expression
    pub left: NodeId,
    /// Expression
    pub right: NodeId,
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
    pub left: NodeId,
    /// Expression
    pub right: NodeId,
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
    pub left: NodeId,
    /// Expression
    pub right: NodeId,
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
    pub expr: NodeId,
}

#[derive(Debug)]
pub enum LogicalUnaryOperator {
    Not,
}

#[derive(Debug)]
pub struct CallExpr {
    /// Identifier (expects: Identifier -> Declaration -> Function)
    pub callee: NodeId,
    /// Expression
    pub args: Vec<NodeId>,
}

#[derive(Debug, Clone)]
pub struct StructExpr {
    pub identifier: String,
    /// StructExprField
    pub field_table: BTreeMap<String, NodeId>,
}

#[derive(Debug, Clone)]
pub struct StructExprField {
    /// expression
    pub body: NodeId,
}

pub(crate) fn show_map(node_map: &BTreeMap<NodeId, Node>, symbol_table: &SymbolTable) {
    for i in 0..node_map.len() {
        show_node(NodeId::new(i), node_map, symbol_table);
    }
}

pub(crate) fn show_node(node_id: NodeId, node_map: &BTreeMap<NodeId, Node>, symbol_table: &SymbolTable) {
    let node = node_id.get(node_map);
    let name = node.get_name();
    match symbol_table.get(node_id).pos {
        Some((line, column)) => println!("[{}] {} ({}:{}) {{", node_id, name, line, column),
        None => println!("[{}] {} (no location) {{", node_id, name),
    }
    match node {
        Node::Declaration(decl) => {
            println!("  identifier: \"{}\"", decl.identifier);
            match &decl.signature {
                Signature::FunctionSignature(signature) => {
                    println!("  signature(FunctionSignature): {{");
                    println!("    params: {{");
                    for param in signature.params.iter() {
                        println!("      [{}]", param);
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
                Signature::StructSignature(signature) => {
                    println!("  signature(StructSignature): {{");
                    println!("    field_table: {{");
                    for (name, node_id) in signature.field_table.iter() {
                        println!("      \"{}\": [{}]", name, node_id);
                    }
                    println!("    }}");
                    println!("  }}");
                }
            }
        }
        Node::Function(func) => {
            println!("  params: {{");
            for param in func.params.iter() {
                println!("    [{}]", param);
            }
            println!("  }}");
            println!("  return_type: {:?}", func.ret_ty);
            match &func.content {
                FunctionBody::Statements(body) => {
                    println!("  body: (statements) {{");
                    for item in body.iter() {
                        println!("    [{}]", item);
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
            println!("    [{}]", variable.content);
            println!("  }}");
        }
        Node::BreakStatement(_) => {}
        Node::ReturnStatement(node) => {
            match node.body {
                Some(x) => {
                    println!("  expr: {{");
                    println!("    [{}]", x);
                    println!("  }}");
                }
                None => {
                    println!("  expr: (None)");
                }
            }
        }
        Node::Assignment(statement) => {
            println!("  dest: {{");
            println!("    [{}]", statement.dest);
            println!("  }}");
            println!("  body: {{");
            println!("    [{}]", statement.body);
            println!("  }}");
        }
        Node::IfStatement(if_statement) => {
            println!("  condition: {{");
            println!("    [{}]", if_statement.condition);
            println!("  }}");
            println!("  then_block: {{");
            for item in if_statement.then_block.iter() {
                println!("    [{}]", item);
            }
            println!("  }}");
            println!("  else_block: {{");
            for item in if_statement.else_block.iter() {
                println!("    [{}]", item);
            }
            println!("  }}");
        }
        Node::LoopStatement(statement) => {
            println!("  body: {{");
            for item in statement.body.iter() {
                println!("    [{}]", item);
            }
            println!("  }}");
        }
        Node::Identifier(x) => {
            println!("  dest: {{");
            println!("    [{}]", x.dest);
            println!("  }}");
        }
        Node::Literal(literal) => {
            println!("  value: {:?}", literal.value);
        }
        Node::RelationalOp(expr) => {
            println!("  operator: {:?}", expr.operator);
            println!("  left: {{");
            println!("    [{}]", expr.left);
            println!("  }}");
            println!("  right: {{");
            println!("    [{}]", expr.right);
            println!("  }}");
        },
        Node::LogicalBinaryOp(expr) => {
            println!("  operator: {:?}", expr.operator);
            println!("  left: {{");
            println!("    [{}]", expr.left);
            println!("  }}");
            println!("  right: {{");
            println!("    [{}]", expr.right);
            println!("  }}");
        },
        Node::ArithmeticOp(expr) => {
            println!("  operator: {:?}", expr.operator);
            println!("  left: {{");
            println!("    [{}]", expr.left);
            println!("  }}");
            println!("  right: {{");
            println!("    [{}]", expr.right);
            println!("  }}");
        },
        Node::LogicalUnaryOp(op) => {
            println!("  operator: {:?}", op.operator);
            println!("  expr: {{");
            println!("    [{}]", op.expr);
            println!("  }}");
        },
        Node::CallExpr(call_expr) => {
            println!("  callee: {{");
            println!("    [{}]", call_expr.callee);
            println!("  }}");
            println!("  args: {{");
            for arg in call_expr.args.iter() {
                println!("    [{}]", arg);
            }
            println!("  }}");
        }
        Node::FuncParam(func_param) => {
            println!("  identifier: \"{}\"", func_param.identifier);
            //println!("  type: {:?}", func_param.ty);
        }
        Node::StructDeclField(_) => {}
        Node::StructExpr(struct_expr) => {
            println!("  identifier: \"{}\"", struct_expr.identifier);
            println!("  field_table: {{");
            for (name, node_id) in struct_expr.field_table.iter() {
                println!("    \"{}\": [{}]", name, node_id);
            }
            println!("  }}");
        }
        Node::StructExprField(field) => {
            println!("  body: {{");
            println!("    [{}]", field.body);
            println!("  }}");
        }
        Node::FieldAccess(node) => {
            println!("  identifier: \"{}\"", node.identifier);
            println!("  target: {{");
            println!("    [{}]", node.target);
            println!("  }}");
        }
    }
    println!("}}");
}

pub struct ResolverStack {
    frames: Vec<ResolverFrame>,
    trace: bool,
}

impl ResolverStack {
    pub fn new(trace: bool) -> Self {
        Self {
            frames: vec![ResolverFrame::new()],
            trace,
        }
    }

    pub fn is_root_frame(&mut self) -> bool {
        self.frames.len() == 1
    }

    pub fn push_frame(&mut self) {
        if self.trace { println!("push_frame"); }
        self.frames.insert(0, ResolverFrame::new());
    }

    pub fn pop_frame(&mut self) {
        if self.trace { println!("pop_frame"); }
        if self.is_root_frame() {
            panic!("Left the root frame.");
        }
        self.frames.remove(0);
    }

    pub fn set_identifier(&mut self, identifier: &str, node_id: NodeId) {
        if self.trace { println!("set_identifier (identifier: \"{}\", node_id: [{}])", identifier, node_id); }
        match self.frames.get_mut(0) {
            Some(frame) => {
                frame.table.insert(identifier.to_string(), node_id);
            }
            None => panic!("frame not found"),
        }
    }

    pub fn lookup_identifier(&self, identifier: &str) -> Option<NodeId> {
        for frame in self.frames.iter() {
            match frame.table.get(identifier) {
                Some(&node_id) => {
                    if self.trace { println!("lookup_identifier success (identifier: \"{}\", node_id: {})", identifier, node_id); }
                    return Some(node_id)
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
    table: BTreeMap<String, NodeId>,
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

    pub fn new_record(&mut self, node_id: NodeId) {
        let record = SymbolRecord {
            ty: None,
            pos: None,
            body: None,
        };
        self.table.insert(node_id, record);
    }

    pub fn set_ty(&mut self, node_id: NodeId, ty: Type) {
        if self.trace { println!("set_ty (node_id: [{}], ty: {:?})", node_id, ty); }
        let record = match self.table.get_mut(&node_id) {
            Some(x) => x,
            None => panic!("symbol not found"),
        };
        record.ty = Some(ty);
    }

    pub fn set_pos(&mut self, node_id: NodeId, pos: (usize, usize)) {
        if self.trace { println!("set_pos (node_id: [{}], pos: {:?})", node_id, pos); }
        let record = match self.table.get_mut(&node_id) {
            Some(x) => x,
            None => panic!("symbol not found"),
        };
        record.pos = Some(pos);
    }

    pub fn set_body(&mut self, node_id: NodeId, body: NodeId) {
        if self.trace { println!("set_body (node_id: [{}], body: [{}])", node_id, body); }
        let record = match self.table.get_mut(&node_id) {
            Some(x) => x,
            None => panic!("symbol not found"),
        };
        record.body = Some(body);
    }

    pub fn get(&self, node_id: NodeId) -> &SymbolRecord {
        if self.trace { println!("get (node_id: [{}])", node_id); }
        match self.table.get(&node_id) {
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
    pub body: Option<NodeId>,
}

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum Type {
    Void,
    Number,
    Bool,
    String,
    Function,
    Struct(NodeId),
}

impl Type {
    pub fn get_name(&self, node_map: &BTreeMap<NodeId, Node>) -> String {
        match self {
            Type::Void => "void".to_owned(),
            Type::Number => "number".to_owned(),
            Type::Bool => "bool".to_owned(),
            Type::String => "string".to_owned(),
            Type::Function => "function".to_owned(),
            Type::Struct(node_id) => {
                let decl = node_id.get(node_map).as_decl().unwrap();
                let ty_name = String::from("struct ") + &decl.identifier;
                ty_name
            }
        }
    }

    pub fn from_identifier(ty_identifier: &str, resolver: &ResolverStack, node_map: &BTreeMap<NodeId, Node>) -> Result<Type, String> {
        match ty_identifier {
            "void" => Err("type `void` is invalid".to_owned()),
            "number" => Ok(Type::Number),
            "bool" => Ok(Type::Bool),
            "string" => Ok(Type::String),
            _ => {
                let node_id = match resolver.lookup_identifier(ty_identifier) {
                    Some(x) => x,
                    None => return Err("unknown type name".to_owned()),
                };
                let decl = match node_id.get(node_map).as_decl() {
                    Ok(x) => x,
                    Err(_) => return Err("unknown type name".to_owned()),
                };
                match &decl.signature {
                    Signature::StructSignature(_) => {
                        Ok(Type::Struct(node_id))
                    }
                    _ => return Err("unknown type name".to_owned()),
                }
            }
        }
    }

    pub fn assert(actual: Type, expected: Type, node_map: &BTreeMap<NodeId, Node>) -> Result<Type, String> {
        if actual == expected {
            Ok(actual)
        } else {
            let message = format!("type mismatched. expected `{}`, found `{}`", expected.get_name(node_map), actual.get_name(node_map));
            Err(message)
        }
    }
}

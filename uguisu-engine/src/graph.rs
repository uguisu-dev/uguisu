use std::collections::HashMap;
use crate::ast;
use crate::types::Type;

pub(crate) type NodeId = usize;

#[derive(Clone, Copy)]
pub struct NodeRef {
    pub id: NodeId,
}

impl NodeRef {
    pub(crate) fn new(node_id: NodeId) -> Self {
        Self { id: node_id }
    }

    pub(crate) fn get<'a>(&self, source: &'a HashMap<NodeId, Node>) -> &'a Node {
        &source[&self.id]
    }

    pub(crate) fn get_mut<'a>(&self, source: &'a mut HashMap<NodeId, Node>) -> &'a mut Node {
        match source.get_mut(&self.id) {
            Some(x) => x,
            None => panic!(),
        }
    }
}

pub(crate) enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    BreakStatement(BreakStatement),
    ReturnStatement(ReturnStatement),
    Assignment(Assignment),
    IfStatement(IfStatement),
    LoopStatement(LoopStatement),
    // expression
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
    pub(crate) fn get_ty(&self) -> Result<Type, String> {
        match self {
            Node::Reference(node) => Ok(node.ty),
            Node::Literal(node) => Ok(node.ty),
            Node::RelationalOp(node) => Ok(node.ty),
            Node::LogicalBinaryOp(node) => Ok(node.ty),
            Node::ArithmeticOp(node) => Ok(node.ty),
            Node::LogicalUnaryOp(node) => Ok(node.ty),
            Node::CallExpr(node) => Ok(node.ty),
            Node::FuncParam(node) => Ok(node.ty),
            Node::VariableDeclaration(node) => {
                match node.ty {
                    Some(ty) => Ok(ty),
                    None => panic!("variable is not defined"),
                }
            }
            Node::FunctionDeclaration(_) => Ok(Type::Function),
            Node::BreakStatement(_)
            | Node::ReturnStatement(_)
            | Node::Assignment(_)
            | Node::IfStatement(_)
            | Node::LoopStatement(_) => {
                panic!("unexpected node");
            }
        }
    }

    pub(crate) fn get_pos(&self) -> (usize, usize) {
        match self {
            Self::FunctionDeclaration(node) => node.pos,
            Self::VariableDeclaration(node) => node.pos,
            Self::BreakStatement(node) => node.pos,
            Self::ReturnStatement(node) => node.pos,
            Self::Assignment(node) => node.pos,
            Self::IfStatement(node) => node.pos,
            Self::LoopStatement(node) => node.pos,
            Self::Reference(node) => node.pos,
            Self::Literal(node) => node.pos,
            Self::RelationalOp(node) => node.pos,
            Self::LogicalBinaryOp(node) => node.pos,
            Self::ArithmeticOp(node) => node.pos,
            Self::LogicalUnaryOp(node) => node.pos,
            Self::CallExpr(node) => node.pos,
            Self::FuncParam(node) => node.pos,
        }
    }

    pub(crate) fn as_variable_decl(&self) -> Result<&VariableDeclaration, String> {
        match self {
            Node::VariableDeclaration(x) => Ok(x),
            _ => Err("variable declaration expected".to_owned()),
        }
    }

    pub(crate) fn as_variable_decl_mut(&mut self) -> Result<&mut VariableDeclaration, String> {
        match self {
            Node::VariableDeclaration(x) => Ok(x),
            _ => Err("variable declaration expected".to_owned()),
        }
    }

    pub(crate) fn as_function_decl(&self) -> Result<&FunctionDeclaration, String> {
        match self {
            Node::FunctionDeclaration(x) => Ok(x),
            _ => Err("function declaration expected".to_owned()),
        }
    }

    pub(crate) fn as_function_decl_mut(&mut self) -> Result<&mut FunctionDeclaration, String> {
        match self {
            Node::FunctionDeclaration(x) => Ok(x),
            _ => Err("function declaration expected".to_owned()),
        }
    }

    pub(crate) fn as_reference(&self) -> Result<&Reference, String> {
        match self {
            Node::Reference(x) => Ok(x),
            _ => Err("reference expected".to_owned()),
        }
    }

    pub(crate) fn as_func_param(&self) -> Result<&FuncParam, String> {
        match self {
            Node::FuncParam(x) => Ok(x),
            _ => Err("function parameter expected".to_owned()),
        }
    }
}

pub(crate) enum FunctionBody {
    Statements(Vec<NodeRef>),
    NativeCode,
}

pub(crate) struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<FunctionBody>,
    pub params: Vec<NodeRef>,
    pub ret_ty: Type,
    pub pos: (usize, usize),
}

pub(crate) struct FuncParam {
    pub identifier: String,
    // pub param_index: usize,
    pub ty: Type,
    pub pos: (usize, usize),
}

pub(crate) struct VariableDeclaration {
    pub identifier: String,
    pub body: Option<NodeRef>,
    pub specified_ty: Option<Type>,
    pub ty: Option<Type>,
    pub pos: (usize, usize),
}

pub(crate) struct BreakStatement {
    pub pos: (usize, usize),
}

pub(crate) struct ReturnStatement {
    pub body: Option<NodeRef>,
    pub pos: (usize, usize),
}

pub(crate) struct Assignment {
    pub dest: NodeRef,
    pub body: NodeRef,
    pub mode: ast::AssignmentMode,
    pub pos: (usize, usize),
}

pub(crate) struct IfStatement {
    pub condition: NodeRef,
    pub then_block: Vec<NodeRef>,
    pub else_block: Vec<NodeRef>,
    pub pos: (usize, usize),
}

pub(crate) struct LoopStatement {
    pub body: Vec<NodeRef>,
    pub pos: (usize, usize),
}

pub(crate) struct Reference {
    pub dest: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

pub(crate) struct Literal {
    pub value: LiteralValue,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub(crate) enum LiteralValue {
    Number(i64),
    Bool(bool),
}

pub(crate) struct RelationalOp {
    pub operator: RelationalOperator,
    pub relation_type: Type,
    pub left: NodeRef,
    pub right: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub(crate) enum RelationalOperator {
    Equal,
    NotEqual,
    GreaterThan,
    GreaterThanEqual,
    LessThan,
    LessThanEqual,
}

pub(crate) struct LogicalBinaryOp {
    pub operator: LogicalBinaryOperator,
    pub left: NodeRef,
    pub right: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub(crate) enum LogicalBinaryOperator {
    And,
    Or,
}

pub(crate) struct LogicalUnaryOp {
    pub operator: LogicalUnaryOperator,
    pub expr: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub(crate) enum LogicalUnaryOperator {
    Not,
}

pub(crate) struct ArithmeticOp {
    pub operator: ArithmeticOperator,
    pub left: NodeRef,
    pub right: NodeRef,
    pub ty: Type,
    pub pos: (usize, usize),
}

#[derive(Debug)]
pub(crate) enum ArithmeticOperator {
    Add,
    Sub,
    Mult,
    Div,
    Mod,
}

pub(crate) struct CallExpr {
    pub callee: NodeRef,
    pub args: Vec<NodeRef>,
    pub ty: Type,
    pub pos: (usize, usize),
}

pub(crate) fn show_node(node_ref: NodeRef, source: &HashMap<NodeId, Node>) {
    let node = node_ref.get(source);
    let name = match node {
        Node::FunctionDeclaration(_) => "FunctionDeclaration",
        Node::VariableDeclaration(_) => "VariableDeclaration",
        Node::BreakStatement(_) => "BreakStatement",
        Node::ReturnStatement(_) => "ReturnStatement",
        Node::Assignment(_) => "Assignment",
        Node::IfStatement(_) => "IfStatement",
        Node::LoopStatement(_) => "LoopStatement",
        Node::Reference(_) => "Reference",
        Node::Literal(_) => "Literal",
        Node::RelationalOp(_) => "RelationalOp",
        Node::LogicalBinaryOp(_) => "LogicalBinaryOp",
        Node::ArithmeticOp(_) => "ArithmeticOp",
        Node::LogicalUnaryOp(_) => "LogicalUnaryOp",
        Node::CallExpr(_) => "CallExpr",
        Node::FuncParam(_) => "FuncParam",
    };
    let (line, column) = node.get_pos();
    println!("[{}] {} ({}:{})", node_ref.id, name, line, column);
    match node {
        Node::FunctionDeclaration(func) => {
            println!("  name: {}", func.identifier);
            println!("  params: {{");
            for param in func.params.iter() {
                println!("    [{}]", param.id);
            }
            println!("  }}");
            match &func.body {
                Some(FunctionBody::Statements(body)) => {
                    println!("  body: {{");
                    for item in body.iter() {
                        println!("    [{}]", item.id);
                    }
                    println!("  }}");
                }
                Some(FunctionBody::NativeCode) => {
                    println!("  body: (native code)");
                }
                None => {
                    println!("  body: (None)");
                }
            }
        }
        Node::VariableDeclaration(variable) => {
            println!("  name: {}", variable.identifier);
            match &variable.body {
                Some(body) => {
                    println!("  body: {{");
                    println!("    [{}]", body.id);
                    println!("  }}");
                }
                None => {
                    println!("  body: (None)");
                }
            }
            match &variable.specified_ty {
                Some(specified_ty) => {
                    println!("  specified_ty: {:?}", specified_ty);
                }
                None => {
                    println!("  specified_ty: (None)");
                }
            }
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
            println!("  name: {}", func_param.identifier);
        }
    }
}

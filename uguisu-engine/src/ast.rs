use crate::parse;

#[derive(PartialEq)]
pub enum Node {
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
    NumberLiteral(NumberLiteral),
    BoolLiteral(BoolLiteral),
    BinaryExpr(BinaryExpr),
    UnaryOp(UnaryOp),
    CallExpr(CallExpr),
    // function declaration
    FuncParam(FuncParam),
}

impl Node {
    pub(crate) fn calc_location(&self, code: &str) -> Result<(usize, usize), String> {
        let pos = match self {
            Node::FunctionDeclaration(node) => node.pos,
            Node::VariableDeclaration(node) => node.pos,
            Node::BreakStatement(node) => node.pos,
            Node::ReturnStatement(node) => node.pos,
            Node::Assignment(node) => node.pos,
            Node::IfStatement(node) => node.pos,
            Node::LoopStatement(node) => node.pos,
            Node::Reference(node) => node.pos,
            Node::NumberLiteral(node) => node.pos,
            Node::BoolLiteral(node) => node.pos,
            Node::BinaryExpr(node) => node.pos,
            Node::UnaryOp(node) => node.pos,
            Node::CallExpr(node) => node.pos,
            Node::FuncParam(node) => node.pos,
        };
        parse::calc_location(pos, code)
    }

    pub(crate) fn new_function_declaration(
        identifier: String,
        body: Option<Vec<Node>>,
        params: Vec<Node>,
        ret: Option<String>,
        attributes: Vec<FunctionAttribute>,
        pos: usize,
    ) -> Self {
        Node::FunctionDeclaration(FunctionDeclaration {
            identifier,
            body,
            params,
            ret,
            attributes,
            pos,
        })
    }

    pub(crate) fn new_func_param(identifier: String, type_identifier: Option<String>, pos: usize) -> Self {
        Node::FuncParam(FuncParam {
            identifier,
            type_identifier,
            pos,
        })
    }

    pub(crate) fn new_variable_declaration(
        identifier: String,
        body: Option<Node>,
        type_identifier: Option<String>,
        attributes: Vec<VariableAttribute>,
        pos: usize,
    ) -> Self {
        let body = match body {
            Some(x) => Some(Box::new(x)),
            None => None,
        };
        Node::VariableDeclaration(VariableDeclaration {
            identifier,
            body,
            type_identifier,
            attributes,
            pos,
        })
    }

    pub(crate) fn new_break_statement(pos: usize) -> Self {
        Node::BreakStatement(BreakStatement {
            pos,
        })
    }

    pub(crate) fn new_return_statement(expr: Option<Node>, pos: usize) -> Self {
        match expr {
            Some(x) => Node::ReturnStatement(ReturnStatement { body: Some(Box::new(x)), pos }),
            None => Node::ReturnStatement(ReturnStatement { body: None, pos }),
        }
    }

    pub(crate) fn new_assignment(dest: Node, body: Node, mode: AssignmentMode, pos: usize) -> Self {
        Node::Assignment(Assignment {
            dest: Box::new(dest),
            body: Box::new(body),
            mode,
            pos,
        })
    }

    pub(crate) fn new_if_statement(cond_blocks: Vec<(Node, Vec<Node>)>, else_block: Option<Vec<Node>>, pos: usize) -> Self {
        let mut items = Vec::new();
        for (cond, block) in cond_blocks {
            items.push((Box::new(cond), block))
        }
        Node::IfStatement(IfStatement {
            cond_blocks: items,
            else_block,
            pos,
        })
    }

    pub(crate) fn new_loop_statement(body: Vec<Node>, pos: usize) -> Self {
        Node::LoopStatement(LoopStatement { body, pos })
    }

    pub(crate) fn new_reference(identifier: &str, pos: usize) -> Self {
        Node::Reference(Reference {
            identifier: identifier.to_string(),
            pos,
        })
    }

    pub(crate) fn new_number(value: i64, pos: usize) -> Self {
        Node::NumberLiteral(NumberLiteral { value, pos })
    }

    pub(crate) fn new_bool(value: bool, pos: usize) -> Self {
        Node::BoolLiteral(BoolLiteral { value, pos })
    }

    pub(crate) fn new_binary_expr(op: &str, left: Node, right: Node, pos: usize) -> Self {
        Node::BinaryExpr(BinaryExpr {
            operator: op.to_string(),
            left: Box::new(left),
            right: Box::new(right),
            pos,
        })
    }

    pub(crate) fn new_unary_op(op: &str, expr: Node, pos: usize) -> Self {
        Node::UnaryOp(UnaryOp {
            operator: op.to_string(),
            expr: Box::new(expr),
            pos,
        })
    }

    pub(crate) fn new_call_expr(callee: Node, args: Vec<Node>, pos: usize) -> Self {
        Node::CallExpr(CallExpr {
            callee: Box::new(callee),
            args,
            pos,
        })
    }

    pub(crate) fn as_func_param(&self) -> &FuncParam {
        match self {
            Node::FuncParam(x) => x,
            _ => panic!("function parameter expected"),
        }
    }
}

#[derive(PartialEq)]
pub struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<Vec<Node>>,
    pub params: Vec<Node>,
    pub ret: Option<String>,
    pub attributes: Vec<FunctionAttribute>,
    pub pos: usize,
}

#[derive(PartialEq)]
pub enum FunctionAttribute {
}

#[derive(PartialEq)]
pub struct FuncParam {
    pub identifier: String,
    pub type_identifier: Option<String>,
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct VariableDeclaration {
    pub identifier: String,
    pub type_identifier: Option<String>,
    pub attributes: Vec<VariableAttribute>,
    pub body: Option<Box<Node>>,
    pub pos: usize,
}

#[derive(PartialEq)]
pub enum VariableAttribute {
    Const,
    Var,
    Let, // NOTE: compatibility
}

#[derive(PartialEq)]
pub struct BreakStatement {
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct ReturnStatement {
    pub body: Option<Box<Node>>,
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct Assignment {
    pub dest: Box<Node>,
    pub body: Box<Node>,
    pub mode: AssignmentMode,
    pub pos: usize,
}

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum AssignmentMode {
    Assign,
    AddAssign,
    SubAssign,
    MultAssign,
    DivAssign,
    ModAssign,
}

#[derive(PartialEq)]
pub struct IfStatement {
    pub cond_blocks: Vec<(Box<Node>, Vec<Node>)>, // if, else if
    pub else_block: Option<Vec<Node>>,            // else
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct LoopStatement {
    pub body: Vec<Node>, // statements
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct Reference {
    pub identifier: String,
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct NumberLiteral {
    pub value: i64,
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct BoolLiteral {
    pub value: bool,
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct BinaryExpr {
    pub operator: String,
    pub left: Box<Node>,
    pub right: Box<Node>,
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct UnaryOp {
    pub operator: String,
    pub expr: Box<Node>,
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct CallExpr {
    pub callee: Box<Node>,
    pub args: Vec<Node>,
    pub pos: usize,
}

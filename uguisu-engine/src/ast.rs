use crate::parse;

#[derive(PartialEq)]
pub enum Node {
    // statement
    Declaration(Declaration),
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
    CallExpr(CallExpr),
    // function declaration
    Function(Function),
    FuncParam(FuncParam),
    // variable declaration
    Variable(Variable),
}

impl Node {
    pub(crate) fn new_declaration(body: Node, pos: usize) -> Self {
        Self::Declaration(Declaration {
            body: Box::new(body),
            pos,
        })
    }

    pub(crate) fn new_break_statement(pos: usize) -> Self {
        Self::BreakStatement(BreakStatement {
            pos,
        })
    }

    pub(crate) fn new_return_statement(expr: Option<Node>, pos: usize) -> Self {
        match expr {
            Some(x) => Self::ReturnStatement(ReturnStatement { body: Some(Box::new(x)), pos }),
            None => Self::ReturnStatement(ReturnStatement { body: None, pos }),
        }
    }

    pub(crate) fn new_assignment(dest: Node, body: Node, mode: AssignmentMode, pos: usize) -> Self {
        Self::Assignment(Assignment {
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
        Self::IfStatement(IfStatement {
            cond_blocks: items,
            else_block,
            pos,
        })
    }

    pub(crate) fn new_loop_statement(body: Vec<Node>, pos: usize) -> Self {
        Self::LoopStatement(LoopStatement { body, pos })
    }

    pub(crate) fn new_reference(identifier: &str, pos: usize) -> Self {
        Self::Reference(Reference {
            identifier: identifier.to_string(),
            pos,
        })
    }

    pub(crate) fn new_number(value: i64, pos: usize) -> Self {
        Self::NumberLiteral(NumberLiteral { value, pos })
    }

    pub(crate) fn new_bool(value: bool, pos: usize) -> Self {
        Self::BoolLiteral(BoolLiteral { value, pos })
    }

    pub(crate) fn new_binary_expr(op: &str, left: Node, right: Node, pos: usize) -> Self {
        Self::BinaryExpr(BinaryExpr {
            operator: op.to_string(),
            left: Box::new(left),
            right: Box::new(right),
            pos,
        })
    }

    pub(crate) fn new_call_expr(callee: Node, args: Vec<Node>, pos: usize) -> Self {
        Self::CallExpr(CallExpr {
            callee: Box::new(callee),
            args,
            pos,
        })
    }

    pub(crate) fn new_function(
        identifier: String,
        body: Option<Vec<Node>>,
        params: Vec<Node>,
        ret: Option<String>,
        attributes: Vec<FunctionAttribute>,
        pos: usize,
    ) -> Self {
        Self::Function(Function {
            identifier,
            body,
            params,
            ret,
            attributes,
            pos,
        })
    }

    pub(crate) fn new_func_param(identifier: String, type_identifier: Option<String>, pos: usize) -> Self {
        Self::FuncParam(FuncParam {
            identifier,
            type_identifier,
            pos,
        })
    }

    pub(crate) fn as_func_param(&self) -> &FuncParam {
        match self {
            Self::FuncParam(x) => x,
            _ => panic!("function parameter expected"),
        }
    }

    pub(crate) fn new_variable(
        identifier: String,
        body: Node,
        type_identifier: Option<String>,
        attributes: Vec<VariableAttribute>,
        pos: usize,
    ) -> Self {
        Self::Variable(Variable {
            identifier,
            body: Box::new(body),
            type_identifier,
            attributes,
            pos,
        })
    }

    pub(crate) fn get_pos(&self) -> usize {
        match self {
            Self::Declaration(node) => node.pos,
            Self::BreakStatement(node) => node.pos,
            Self::ReturnStatement(node) => node.pos,
            Self::Assignment(node) => node.pos,
            Self::IfStatement(node) => node.pos,
            Self::LoopStatement(node) => node.pos,
            Self::Reference(node) => node.pos,
            Self::NumberLiteral(node) => node.pos,
            Self::BoolLiteral(node) => node.pos,
            Self::BinaryExpr(node) => node.pos,
            Self::CallExpr(node) => node.pos,
            Self::Function(node) => node.pos,
            Self::FuncParam(node) => node.pos,
            Self::Variable(node) => node.pos,
        }
    }

    pub(crate) fn calc_location(&self, code: &str) -> Result<(usize, usize), String> {
        parse::calc_location(self.get_pos(), code)
    }
}

#[derive(PartialEq)]
pub struct Declaration {
    pub body: Box<Node>,
    pub pos: usize,
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

#[derive(PartialEq, Clone, Copy)]
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
pub struct CallExpr {
    pub callee: Box<Node>,
    pub args: Vec<Node>,
    pub pos: usize,
}

#[derive(PartialEq)]
pub struct Function {
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
pub struct Variable {
    pub identifier: String,
    pub body: Box<Node>,
    pub type_identifier: Option<String>,
    pub attributes: Vec<VariableAttribute>,
    pub pos: usize,
}

#[derive(PartialEq)]
pub enum VariableAttribute {
    Const,
    Let,
}

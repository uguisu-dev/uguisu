//
// Statement
//

#[derive(Debug, PartialEq)]
pub enum Statement {
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    ReturnStatement(Option<Expression>),
    Assignment(Assignment),
    ExprStatement(Expression),
}

#[derive(Debug, PartialEq)]
pub struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<Vec<Statement>>,
    pub params: Vec<Parameter>,
    pub ret: Option<String>,
    pub attributes: Vec<FunctionAttribute>,
}

#[derive(Debug, PartialEq)]
pub struct Parameter {
    pub identifier: String,
    pub type_identifier: Option<String>,
}

#[derive(Debug, PartialEq)]
pub enum FunctionAttribute {
    External,
    //Export,
}

pub fn parameter(identifier: String, type_identifier: Option<String>) -> Parameter {
    Parameter {
        identifier,
        type_identifier,
    }
}

pub fn function_declaration(
    identifier: String,
    body: Option<Vec<Statement>>,
    params: Vec<Parameter>,
    ret: Option<String>,
    attributes: Vec<FunctionAttribute>,
) -> Statement {
    Statement::FunctionDeclaration(FunctionDeclaration {
        identifier,
        body,
        params,
        ret,
        attributes,
    })
}

#[derive(Debug, PartialEq)]
pub struct VariableDeclaration {
    pub identifier: String,
    pub body: Expression,
    pub attributes: Vec<VariableAttribute>,
}

#[derive(Debug, PartialEq)]
pub enum VariableAttribute {
    Const,
    Let,
}

pub fn variable_declaration(
    identifier: String,
    body: Expression,
    attributes: Vec<VariableAttribute>,
) -> Statement {
    Statement::VariableDeclaration(VariableDeclaration {
        identifier,
        body,
        attributes,
    })
}

#[derive(Debug, PartialEq)]
pub struct Assignment {
    pub identifier: String,
    pub body: Expression,
}

pub fn assignment(identifier: String, body: Expression) -> Statement {
    Statement::Assignment(Assignment { identifier, body })
}

//
// expressions
//

#[derive(Debug, PartialEq)]
pub enum Expression {
    Identifier(String),
    Literal(Literal),
    BinaryExpr(BinaryExpr),
    CallExpr(CallExpr),
}

#[derive(Debug, PartialEq)]
pub enum Literal {
    Number(i32),
    //Bool(bool),
}

pub fn number(value: i32) -> Expression {
    Expression::Literal(Literal::Number(value))
}

#[derive(Debug, PartialEq)]
pub struct BinaryExpr {
    pub operator: Operator,
    pub left: Box<Expression>,
    pub right: Box<Expression>,
}

#[derive(Debug, PartialEq)]
pub enum Operator {
    Add,
    Sub,
    Mult,
    Div,
}

pub fn add_operation(left: Expression, right: Expression) -> Expression {
    Expression::BinaryExpr(BinaryExpr {
        operator: Operator::Add,
        left: Box::new(left),
        right: Box::new(right),
    })
}

pub fn sub_operation(left: Expression, right: Expression) -> Expression {
    Expression::BinaryExpr(BinaryExpr {
        operator: Operator::Sub,
        left: Box::new(left),
        right: Box::new(right),
    })
}

pub fn mult_operation(left: Expression, right: Expression) -> Expression {
    Expression::BinaryExpr(BinaryExpr {
        operator: Operator::Mult,
        left: Box::new(left),
        right: Box::new(right),
    })
}

pub fn div_operation(left: Expression, right: Expression) -> Expression {
    Expression::BinaryExpr(BinaryExpr {
        operator: Operator::Div,
        left: Box::new(left),
        right: Box::new(right),
    })
}

#[derive(Debug, PartialEq)]
pub struct CallExpr {
    pub callee: Box<Expression>,
    pub args: Vec<Expression>,
}

pub fn call_expr(callee: Expression, args: Vec<Expression>) -> Expression {
    Expression::CallExpr(CallExpr {
        callee: Box::new(callee),
        args,
    })
}

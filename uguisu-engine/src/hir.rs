// module statement

#[derive(Debug, PartialEq)]
pub enum ModuleStatement {
    FunctionDeclaration(FunctionDeclaration),
}

#[derive(Debug, PartialEq)]
pub struct FunctionDeclaration {
    pub identifier: String,
    pub param_names: Vec<String>,
    pub param_kinds: Vec<ValueKind>,
    pub return_kind: Option<ValueKind>,
    pub body: Option<Vec<LocalStatement>>,
    pub attributes: Vec<FunctionAttribute>,
}

#[derive(Debug, PartialEq)]
pub enum FunctionAttribute {
    External,
    //Export,
}

// local statement

#[derive(Debug, PartialEq)]
pub enum LocalStatement {
    VariableDeclaration(VariableDeclaration),
    ReturnStatement(Option<Expression>),
    Assignment(Assignment),
    ExprStatement(Expression),
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

#[derive(Debug, PartialEq)]
pub struct Assignment {
    pub identifier: String,
    pub body: Expression,
}

// expression

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

#[derive(Debug, PartialEq)]
pub struct CallExpr {
    pub callee: Box<Expression>,
    pub args: Vec<Expression>,
}

// others

#[derive(Debug, PartialEq, Clone)]
pub enum ValueKind {
    Number,
}

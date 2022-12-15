#[derive(Debug, PartialEq)]
pub enum Statement {
    FuncDeclaration(FuncDeclaration),
    Return(Option<Box<Expression>>),
    //VarDeclaration(VarDeclaration),
    Expression(Expression),
}

impl Statement {
    pub fn func_declaration(identifier: &str, params: Vec<String>, ret: Option<String>, body: Option<Vec<Statement>>, attributes: Vec<FuncAttribute>) -> Statement {
        Statement::FuncDeclaration(FuncDeclaration {
            identifier: identifier.to_string(),
            params,
            ret,
            body,
            attributes,
        })
    }

    pub fn return_statement() -> Statement {
        Statement::Return(None)
    }

    pub fn return_statement_with_value(expr: Expression) -> Statement {
        Statement::Return(Some(Box::new(expr)))
    }
}

#[derive(Debug, PartialEq)]
pub enum Expression {
    Number(i32),
    BinaryOp(BinaryOp),
    Call(CallNode),
    //Identifier(String),
    //Bool(bool),
}

impl Expression {
    pub fn number(value: i32) -> Expression {
        Expression::Number(value)
    }

    pub fn add(left: Expression, right: Expression) -> Expression {
        Expression::BinaryOp(BinaryOp {
            kind: BinaryOpKind::Add,
            left: Box::new(left),
            right: Box::new(right),
        })
    }

    pub fn sub(left: Expression, right: Expression) -> Expression {
        Expression::BinaryOp(BinaryOp {
            kind: BinaryOpKind::Sub,
            left: Box::new(left),
            right: Box::new(right),
        })
    }

    pub fn mult(left: Expression, right: Expression) -> Expression {
        Expression::BinaryOp(BinaryOp {
            kind: BinaryOpKind::Mult,
            left: Box::new(left),
            right: Box::new(right),
        })
    }

    pub fn div(left: Expression, right: Expression) -> Expression {
        Expression::BinaryOp(BinaryOp {
            kind: BinaryOpKind::Div,
            left: Box::new(left),
            right: Box::new(right),
        })
    }

    // pub fn identifier(name: &str) -> Expression {
    //     Expression::Identifier(name.to_string())
    // }

    pub fn call(target_name: &str, args: Vec<Expression>) -> Expression {
        Expression::Call(CallNode { target_name: target_name.to_string(), args })
    }

    // pub fn function(children: Vec<Statement>) -> Expression {
    //     Expression::Function(FunctionNode { children })
    // }
}

#[derive(Debug, PartialEq)]
pub struct BinaryOp {
    pub kind: BinaryOpKind,
    pub left: Box<Expression>,
    pub right: Box<Expression>,
}

#[derive(Debug, PartialEq)]
pub enum BinaryOpKind {
    Add,
    Sub,
    Mult,
    Div,
}

// #[derive(Debug, PartialEq)]
// pub struct VarDeclaration {
//     pub identifier: String,
//     pub attributes: Vec<VarAttribute>,
//     pub definition: Option<Box<Expression>>,
// }

// #[derive(Debug, PartialEq)]
// pub enum VarAttribute {
//     Const,
//     Let,
// }

#[derive(Debug, PartialEq)]
pub struct FuncDeclaration {
    pub identifier: String,
    pub params: Vec<String>,
    pub ret: Option<String>,
    pub body: Option<Vec<Statement>>,
    pub attributes: Vec<FuncAttribute>,
}

#[derive(Debug, PartialEq)]
pub enum FuncAttribute {
    External,
    //Export,
}

#[derive(Debug, PartialEq)]
pub struct CallNode {
    pub target_name: String,
    pub args: Vec<Expression>,
}

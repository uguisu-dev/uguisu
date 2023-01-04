use crate::resolve;

mod test;

//
// node
//

#[derive(Debug, PartialEq)]
pub enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    ReturnStatement(Option<Box<Node>>),
    Assignment(Assignment),
    // expression
    NodeRef(NodeRef),
    Literal(Literal),
    BinaryExpr(BinaryExpr),
    CallExpr(CallExpr),
}

#[derive(Debug, PartialEq)]
pub struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<Vec<Node>>,
    pub params: Vec<Parameter>,
    pub ret: Option<String>,
    pub attributes: Vec<FunctionAttribute>,
    pub symbol: Option<resolve::SymbolId>,
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

#[derive(Debug, PartialEq)]
pub struct VariableDeclaration {
    pub identifier: String,
    pub body: Box<Node>,
    pub attributes: Vec<VariableAttribute>,
}

#[derive(Debug, PartialEq)]
pub enum VariableAttribute {
    Const,
    Let,
}

#[derive(Debug, PartialEq)]
pub struct Assignment {
    pub dest: String,
    pub body: Box<Node>,
}

#[derive(Debug, PartialEq)]
pub struct ResolvedNodeRef {
    pub symbol: resolve::SymbolId,
}

#[derive(Debug, PartialEq)]
pub struct NodeRef {
    pub identifier: String,
    pub resolved: Option<ResolvedNodeRef>,
}

#[derive(Debug, PartialEq)]
pub enum Literal {
    Number(i32),
}

#[derive(Debug, PartialEq)]
pub struct BinaryExpr {
    pub operator: Operator,
    pub left: Box<Node>,
    pub right: Box<Node>,
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
    pub callee: Box<Node>,
    pub args: Vec<Node>,
}

//
// node utility
//

pub fn parameter(identifier: String, type_identifier: Option<String>) -> Parameter {
    Parameter {
        identifier,
        type_identifier,
    }
}

pub fn function_declaration(
    identifier: String,
    body: Option<Vec<Node>>,
    params: Vec<Parameter>,
    ret: Option<String>,
    attributes: Vec<FunctionAttribute>,
) -> Node {
    Node::FunctionDeclaration(FunctionDeclaration {
        identifier,
        body,
        params,
        ret,
        attributes,
        symbol: None,
    })
}

pub fn variable_declaration(
    identifier: String,
    body: Node,
    attributes: Vec<VariableAttribute>,
) -> Node {
    Node::VariableDeclaration(VariableDeclaration {
        identifier,
        body: Box::new(body),
        attributes,
    })
}

pub fn assignment(dest: String, body: Node) -> Node {
    Node::Assignment(Assignment {
        dest,
        body: Box::new(body),
    })
}

pub fn number(value: i32) -> Node {
    Node::Literal(Literal::Number(value))
}

pub fn add_operation(left: Node, right: Node) -> Node {
    Node::BinaryExpr(BinaryExpr {
        operator: Operator::Add,
        left: Box::new(left),
        right: Box::new(right),
    })
}

pub fn sub_operation(left: Node, right: Node) -> Node {
    Node::BinaryExpr(BinaryExpr {
        operator: Operator::Sub,
        left: Box::new(left),
        right: Box::new(right),
    })
}

pub fn mult_operation(left: Node, right: Node) -> Node {
    Node::BinaryExpr(BinaryExpr {
        operator: Operator::Mult,
        left: Box::new(left),
        right: Box::new(right),
    })
}

pub fn div_operation(left: Node, right: Node) -> Node {
    Node::BinaryExpr(BinaryExpr {
        operator: Operator::Div,
        left: Box::new(left),
        right: Box::new(right),
    })
}

pub fn call_expr(callee: Node, args: Vec<Node>) -> Node {
    Node::CallExpr(CallExpr {
        callee: Box::new(callee),
        args,
    })
}

//
// parser
//

#[derive(Debug)]
pub struct ParserError {
    pub message: String,
}

impl ParserError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

// NOTE: The ** operator may have bugs. Therefore, the ++ operator is used.

peg::parser! {
    grammar uguisu_parser() for str {
        pub rule root() -> Vec<Node>
            = __* s:statements()? __* { if let Some(v) = s { v } else { vec![] } }

        rule statements() -> Vec<Node>
            = statement() ++ (__*)

        pub rule statement() -> Node
            = function_declaration()
            / return_statement()
            / variable_declaration()
            / assignment()
            / e:expression() __* ";" { e }

        pub rule expression() -> Node = precedence! {
            // left:(@) __* "==" __* right:@ { Node::eq(left, right) }
            // left:(@) __* "!=" __* right:@ { Node::ne(left, right) }
            // --
            // left:(@) __* "<" __* right:@ { Node::lt(left, right) }
            // left:(@) __* "<=" __* right:@ { Node::lte(left, right) }
            // left:(@) __* ">" __* right:@ { Node::gt(left, right) }
            // left:(@) __* ">=" __* right:@ { Node::gte(left, right) }
            // --
            left:(@) __* "+" __* right:@ { add_operation(left, right) }
            left:(@) __* "-" __* right:@ { sub_operation(left, right) }
            --
            left:(@) __* "*" __* right:@ { mult_operation(left, right) }
            left:(@) __* "/" __* right:@ { div_operation(left, right) }
            // left:(@) __* "%" __* right:@ { Node::mod(left, right) }
            --
            // "!" __* right:(@) { right }
            // "+" __* right:(@) { right }
            // "-" __* right:(@) { Node::mult(Node::number(-1), right) }
            // --
            e:number() { e }
            e:call_expr() { e }
            id:idenfitier() { Node::NodeRef(NodeRef { identifier: id.to_string(), resolved: None }) }
            p:position!() "(" __* e:expression() __* ")" { p; e }
        }

        rule function_declaration() -> Node =
            attrs:func_dec_attrs()? "fn" __+ name:idenfitier() __* "(" __* params:func_dec_params()? __* ")" __* ret:func_dec_return_type()? __*
            body:func_dec_body()
        {
            let params = if let Some(v) = params { v } else { vec![] };
            let attrs = if let Some(v) = attrs { v } else { vec![] };
            function_declaration(name.to_string(), body, params, ret, attrs)
        }

        rule func_dec_params() -> Vec<Parameter>
            = func_dec_param() ++ (__* "," __*)

        rule func_dec_param() -> Parameter
            = name:idenfitier() type_name:(__* ":" __* n:idenfitier() { n.to_string() })?
        { parameter(name.to_string(), type_name) }

        rule func_dec_return_type() -> String
            = ":" __* type_name:idenfitier() { type_name.to_string() }

        rule func_dec_body() -> Option<Vec<Node>>
            = "{" __* s:statements()? __* "}" { Some(if let Some(v) = s { v } else { vec![] }) }
            / ";" { None }

        rule func_dec_attrs() -> Vec<FunctionAttribute>
            = attrs:(func_dec_attr() ++ (__+)) __+ { attrs }

        rule func_dec_attr() -> FunctionAttribute
            = "external" { FunctionAttribute::External }

        rule return_statement() -> Node
            = "return" e2:(__+ e1:expression() { Box::new(e1) })? __* ";" { Node::ReturnStatement(e2) }

        rule variable_declaration() -> Node
            = kind:(
                "let" {VariableAttribute::Let} / "const" {VariableAttribute::Const}
            ) __+ id:idenfitier() __* "=" __* e:expression() ";"
        { variable_declaration(id.to_string(), e, vec![kind]) }

        rule assignment() -> Node
            = id:idenfitier() __* "=" __* e:expression() ";"
        { assignment(id.to_string(), e) }

        rule number() -> Node
            = n:$(['1'..='9'] ['0'..='9']+)
        {? n.parse().or(Err("u32")).and_then(|n| Ok(number(n))) }
            / n:$(['0'..='9'])
        {? n.parse().or(Err("u32")).and_then(|n| Ok(number(n))) }

        rule call_expr() -> Node
            = name:idenfitier() __* "(" __* args:call_params()? __* ")"
        {
            let args = if let Some(v) = args { v } else { vec![] };
            call_expr(Node::NodeRef(NodeRef { identifier: name.to_string(), resolved: None }), args)
        }

        rule call_params() -> Vec<Node>
            = expression() ++ (__* "," __*)

        rule idenfitier() -> &'input str
            = !['0'..='9'] s:$(identifier_char()+) { s }

        rule identifier_char() -> char
            = &['\u{00}'..='\u{7F}'] c:['A'..='Z'|'a'..='z'|'0'..='9'|'_'] { c }
            / !['\u{00}'..='\u{7F}'] c:[_] { c }

        rule __() -> char
            = quiet! { c:[' '|'\t'|'\r'|'\n'] { c } }
    }
}

pub fn parse(input: &str) -> Result<Vec<Node>, ParserError> {
    match uguisu_parser::root(input) {
        Ok(n) => Ok(n),
        Err(e) => Err(ParserError::new(
            format!("expects {}. ({})", e.expected, e.location).as_str(),
        )),
    }
}

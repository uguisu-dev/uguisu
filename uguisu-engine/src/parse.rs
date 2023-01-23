#[cfg(test)]
mod test;

//
// node
//

#[derive(Debug, PartialEq)]
pub enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    BreakStatement,
    ReturnStatement(Option<Box<Node>>),
    Assignment(Assignment),
    IfStatement(IfStatement),
    LoopStatement(LoopStatement),
    // expression
    Reference(Reference),
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
    pub type_identifier: Option<String>,
    pub attributes: Vec<VariableAttribute>,
}

#[derive(Debug, PartialEq)]
pub enum VariableAttribute {
    Const,
    Let,
}

#[derive(Debug, PartialEq)]
pub struct Assignment {
    pub dest: Box<Node>,
    pub body: Box<Node>,
}

#[derive(Debug, PartialEq)]
pub struct Reference {
    pub identifier: String,
}

#[derive(Debug, PartialEq)]
pub enum Literal {
    Number(i64),
    Bool(bool),
}

#[derive(Debug, PartialEq)]
pub struct BinaryExpr {
    pub operator: String,
    pub left: Box<Node>,
    pub right: Box<Node>,
}

#[derive(Debug, PartialEq)]
pub struct CallExpr {
    pub callee: Box<Node>,
    pub args: Vec<Node>,
}

#[derive(Debug, PartialEq)]
pub struct IfStatement {
    pub cond_blocks: Vec<(Box<Node>, Vec<Node>)>, // Vec(expression & statements)
    pub else_block: Option<Vec<Node>>, // statements
}

#[derive(Debug, PartialEq)]
pub struct LoopStatement {
    pub body: Vec<Node>, // statements
}

#[derive(Debug, PartialEq)]
pub struct BlockExpr {
    body: Vec<Node>, // statements
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
    })
}

pub fn variable_declaration(
    identifier: String,
    body: Node,
    type_identifier: Option<String>,
    attributes: Vec<VariableAttribute>,
) -> Node {
    Node::VariableDeclaration(VariableDeclaration {
        identifier,
        body: Box::new(body),
        type_identifier,
        attributes,
    })
}

pub fn return_statement(
    expr: Option<Node>,
) -> Node {
    match expr {
        Some(x) => Node::ReturnStatement(Some(Box::new(x))),
        None => Node::ReturnStatement(None),
    }
}

pub fn assignment(dest: Node, body: Node) -> Node {
    Node::Assignment(Assignment {
        dest: Box::new(dest),
        body: Box::new(body),
    })
}

pub fn reference(id: &str) -> Node {
    Node::Reference(Reference {
        identifier: id.to_string(),
    })
}

pub fn number(value: i64) -> Node {
    Node::Literal(Literal::Number(value))
}

pub fn bool(value: bool) -> Node {
    Node::Literal(Literal::Bool(value))
}

pub fn binary_expr(op: &str, left: Node, right: Node) -> Node {
    Node::BinaryExpr(BinaryExpr {
        operator: op.to_string(),
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

pub fn if_statement(
    cond_blocks: Vec<(Node, Vec<Node>)>,
    else_block: Option<Vec<Node>>,
) -> Node {
    let mut items = Vec::new();
    for (cond, block) in cond_blocks {
        items.push((Box::new(cond), block))
    }
    Node::IfStatement(IfStatement {
        cond_blocks: items,
        else_block,
    })
}

pub fn loop_statement(body: Vec<Node>) -> Node {
    Node::LoopStatement(LoopStatement {
        body,
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
            / break_statement()
            / return_statement()
            / variable_declaration()
            / if_statement()
            / loop_statement()
            / assignment()
            / e:expression() __* ";" { e }

        pub rule expression() -> Node = precedence! {
            left:(@) __* "==" __* right:@ { binary_expr("==", left, right) }
            left:(@) __* "!=" __* right:@ { binary_expr("!=", left, right) }
            --
            left:(@) __* "<" __* right:@ { binary_expr("<", left, right) }
            left:(@) __* "<=" __* right:@ { binary_expr("<=", left, right) }
            left:(@) __* ">" __* right:@ { binary_expr(">", left, right) }
            left:(@) __* ">=" __* right:@ { binary_expr(">=", left, right) }
            --
            left:(@) __* "+" __* right:@ { binary_expr("+", left, right) }
            left:(@) __* "-" __* right:@ { binary_expr("-", left, right) }
            --
            left:(@) __* "*" __* right:@ { binary_expr("*", left, right) }
            left:(@) __* "/" __* right:@ { binary_expr("/", left, right) }
            // left:(@) __* "%" __* right:@ { Node::mod(left, right) }
            --
            // "!" __* right:(@) { right }
            // "+" __* right:(@) { right }
            // "-" __* right:(@) { Node::mult(Node::number(-1), right) }
            // --
            e:number() { e }
            e:bool() { e }
            e:call_expr() { e }
            id:idenfitier() { reference(id) }
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

        rule break_statement() -> Node
            = "break" __* ";" { Node::BreakStatement }

        rule return_statement() -> Node
            = "return" e2:(__+ e1:expression() { e1 })? __* ";" { return_statement(e2) }

        rule variable_declaration() -> Node
            = kind:(
                "let" {VariableAttribute::Let} / "const" {VariableAttribute::Const}
            ) __+ id:idenfitier() ty:(__* ":" __* x:idenfitier() {x.to_string()})? __* "=" __* e:expression() ";"
        { variable_declaration(id.to_string(), e, ty, vec![kind]) }

        rule assignment() -> Node
            = id:idenfitier() __* "=" __* e:expression() ";"
        { assignment(reference(id), e) }

        rule number() -> Node
            = quiet!{ n:$(['1'..='9'] ['0'..='9']+)
        {? n.parse().or(Err("u32")).and_then(|n| Ok(number(n))) } }
            / quiet!{ n:$(['0'..='9'])
        {? n.parse().or(Err("u32")).and_then(|n| Ok(number(n))) } }
            / expected!("number")

        rule bool() -> Node
            = "true" { bool(true) }
            / "false" { bool(false) }

        rule call_expr() -> Node
            = name:idenfitier() __* "(" __* args:call_params()? __* ")"
        {
            let args = if let Some(v) = args { v } else { vec![] };
            call_expr(reference(name), args)
        }

        rule call_params() -> Vec<Node>
            = expression() ++ (__* "," __*)

        rule if_statement() -> Node
            = head:if_cond_block() tails:(__* x:elseif_parts() {x})? else_block:(__* x:else_part() {x})? {
                let cond_blocks = if let Some(x) = tails {
                    let mut items = vec![head];
                    items.extend(x);
                    items
                } else {
                    vec![head]
                };
                if_statement(cond_blocks, else_block)
            }

        rule if_cond_block() -> (Node, Vec<Node>)
            = "if" __+ cond:expression() __* body:block() {
                (cond, body)
            }

        rule elseif_parts() -> Vec<(Node, Vec<Node>)>
            = elseif_part() ++ (__*)

        rule elseif_part() -> (Node, Vec<Node>)
            = "else" __+ cond_block:if_cond_block() {
                cond_block
            }

        rule else_part() -> Vec<Node>
            = "else" __* body:block() {
                body
            }

        rule loop_statement() -> Node
            = "loop" __* body:block() {
                loop_statement(body)
            }

        rule block() -> Vec<Node>
            = "{" __* s:statements()? __* "}" {
                if let Some(nodes) = s {
                    nodes
                } else {
                    vec![]
                }
            }

        rule idenfitier() -> &'input str
            = quiet!{ !['0'..='9'] s:$(identifier_char()+) { s } }
            / expected!("identifier")

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

use crate::SyntaxError;

#[cfg(test)]
mod test;

//
// node
//

#[derive(Debug, PartialEq)]
pub struct Node {
    pub inner: NodeInner,
    pub location: Option<usize>,
}

#[derive(Debug, PartialEq)]
pub enum NodeInner {
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
    // function
    FuncParam(FuncParam),
}

impl NodeInner {
    pub fn as_node(self, location: usize) -> Node {
        Node {
            inner: self,
            location: Some(location),
        }
    }

    pub fn as_node_internal(self) -> Node {
        Node {
            inner: self,
            location: None,
        }
    }

    pub fn as_func_param(&self) -> &FuncParam {
        match self {
            NodeInner::FuncParam(x) => x,
            _ => panic!("function parameter expected"),
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct FunctionDeclaration {
    pub identifier: String,
    pub body: Option<Vec<Node>>,
    pub params: Vec<Node>,
    pub ret: Option<String>,
    pub attributes: Vec<FunctionAttribute>,
}

#[derive(Debug, PartialEq)]
pub struct FuncParam {
    pub identifier: String,
    pub type_identifier: Option<String>,
}

#[derive(Debug, PartialEq)]
pub enum FunctionAttribute {
    External,
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
    pub mode: AssignmentMode,
}

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum AssignmentMode {
    Assign,
    AddAssign,
    SubAssign,
    MultAssign,
    DivAssign,
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
    pub cond_blocks: Vec<(Box<Node>, Vec<Node>)>, // if, else if
    pub else_block: Option<Vec<Node>>,            // else
}

#[derive(Debug, PartialEq)]
pub struct LoopStatement {
    pub body: Vec<Node>, // statements
}

//
// node utility
//

pub fn function_declaration(
    identifier: String,
    body: Option<Vec<Node>>,
    params: Vec<Node>,
    ret: Option<String>,
    attributes: Vec<FunctionAttribute>,
) -> NodeInner {
    NodeInner::FunctionDeclaration(FunctionDeclaration {
        identifier,
        body,
        params,
        ret,
        attributes,
    })
}

pub fn func_param(identifier: String, type_identifier: Option<String>) -> NodeInner {
    NodeInner::FuncParam(FuncParam {
        identifier,
        type_identifier,
    })
}

pub fn variable_declaration(
    identifier: String,
    body: Node,
    type_identifier: Option<String>,
    attributes: Vec<VariableAttribute>,
) -> NodeInner {
    NodeInner::VariableDeclaration(VariableDeclaration {
        identifier,
        body: Box::new(body),
        type_identifier,
        attributes,
    })
}

pub fn return_statement(expr: Option<Node>) -> NodeInner {
    match expr {
        Some(x) => NodeInner::ReturnStatement(Some(Box::new(x))),
        None => NodeInner::ReturnStatement(None),
    }
}

pub fn assignment(dest: Node, body: Node, mode: AssignmentMode) -> NodeInner {
    NodeInner::Assignment(Assignment {
        dest: Box::new(dest),
        body: Box::new(body),
        mode,
    })
}

pub fn reference(identifier: &str) -> NodeInner {
    NodeInner::Reference(Reference {
        identifier: identifier.to_string(),
    })
}

pub fn number(value: i64) -> NodeInner {
    NodeInner::Literal(Literal::Number(value))
}

pub fn bool(value: bool) -> NodeInner {
    NodeInner::Literal(Literal::Bool(value))
}

pub fn binary_expr(op: &str, left: Node, right: Node) -> NodeInner {
    NodeInner::BinaryExpr(BinaryExpr {
        operator: op.to_string(),
        left: Box::new(left),
        right: Box::new(right),
    })
}

pub fn call_expr(callee: Node, args: Vec<Node>) -> NodeInner {
    NodeInner::CallExpr(CallExpr {
        callee: Box::new(callee),
        args,
    })
}

pub fn if_statement(cond_blocks: Vec<(Node, Vec<Node>)>, else_block: Option<Vec<Node>>) -> NodeInner {
    let mut items = Vec::new();
    for (cond, block) in cond_blocks {
        items.push((Box::new(cond), block))
    }
    NodeInner::IfStatement(IfStatement {
        cond_blocks: items,
        else_block,
    })
}

pub fn loop_statement(body: Vec<Node>) -> NodeInner {
    NodeInner::LoopStatement(LoopStatement { body })
}

//
// parser
//

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
            left:(@) __* p:pos() "==" __* right:@ { binary_expr("==", left, right).as_node(p) }
            left:(@) __* p:pos() "!=" __* right:@ { binary_expr("!=", left, right).as_node(p) }
            --
            left:(@) __* p:pos() "<" __* right:@ { binary_expr("<", left, right).as_node(p) }
            left:(@) __* p:pos() "<=" __* right:@ { binary_expr("<=", left, right).as_node(p) }
            left:(@) __* p:pos() ">" __* right:@ { binary_expr(">", left, right).as_node(p) }
            left:(@) __* p:pos() ">=" __* right:@ { binary_expr(">=", left, right).as_node(p) }
            --
            left:(@) __* p:pos() "+" __* right:@ { binary_expr("+", left, right).as_node(p) }
            left:(@) __* p:pos() "-" __* right:@ { binary_expr("-", left, right).as_node(p) }
            --
            left:(@) __* p:pos() "*" __* right:@ { binary_expr("*", left, right).as_node(p) }
            left:(@) __* p:pos() "/" __* right:@ { binary_expr("/", left, right).as_node(p) }
            // left:(@) __* "%" __* right:@ { Node::mod(left, right) }
            --
            // "!" __* right:(@) { right }
            // "+" __* right:(@) { right }
            // "-" __* right:(@) { Node::mult(Node::number(-1), right) }
            // --
            e:number() { e }
            e:bool() { e }
            e:call_expr() { e }
            p:pos() id:idenfitier() { reference(id).as_node(p) }
            "(" __* e:expression() __* ")" { e }
        }

        rule function_declaration() -> Node =
            p:pos() attrs:func_dec_attrs()? "fn" __+ name:idenfitier() __* "(" __* params:func_dec_params()? __* ")"
            __* ret:func_dec_return_type()? __* body:func_dec_body()
        {
            let params = if let Some(v) = params { v } else { vec![] };
            let attrs = if let Some(v) = attrs { v } else { vec![] };
            function_declaration(name.to_string(), body, params, ret, attrs).as_node(p)
        }

        rule func_dec_params() -> Vec<Node>
            = func_dec_param() ++ (__* "," __*)

        rule func_dec_param() -> Node
            = p:pos() name:idenfitier() type_name:(__* ":" __* n:idenfitier() { n.to_string() })?
        { func_param(name.to_string(), type_name).as_node(p) }

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
            = p:pos() "break" __* ";" { NodeInner::BreakStatement.as_node(p) }

        rule return_statement() -> Node
            = p:pos() "return" e2:(__+ e1:expression() { e1 })? __* ";" { return_statement(e2).as_node(p) }

        rule variable_declaration() -> Node
            = p:pos() kind:(
                "let" {VariableAttribute::Let} / "const" {VariableAttribute::Const}
            ) __+ id:idenfitier() ty:(__* ":" __* x:idenfitier() {x.to_string()})? __* "=" __* e:expression() ";"
        { variable_declaration(id.to_string(), e, ty, vec![kind]).as_node(p) }

        rule assignment() -> Node
            = p:pos() id:idenfitier() __* mode:assignment_mode() __* e:expression() ";" {
                assignment(reference(id).as_node(p), e, mode).as_node(p)
            }

        rule assignment_mode() -> AssignmentMode
            = "=" { AssignmentMode::Assign }
            / "+=" { AssignmentMode::AddAssign }
            / "-=" { AssignmentMode::SubAssign }
            / "*=" { AssignmentMode::MultAssign }
            / "/=" { AssignmentMode::DivAssign }

        rule number() -> Node
            = quiet! {
                p:pos() n:$(['1'..='9'] ['0'..='9']+) {? n.parse().or(Err("u32")).and_then(|n| Ok(number(n).as_node(p))) } }
            / quiet!{
                p:pos() n:$(['0'..='9']) {? n.parse().or(Err("u32")).and_then(|n| Ok(number(n).as_node(p))) } }
            / expected!("number")

        rule bool() -> Node
            = p:pos() "true" { bool(true).as_node(p) }
            / p:pos() "false" { bool(false).as_node(p) }

        rule call_expr() -> Node
            = p:pos() name:idenfitier() __* "(" __* args:call_params()? __* ")"
        {
            let args = if let Some(v) = args { v } else { vec![] };
            call_expr(reference(name).as_node(p), args).as_node(p)
        }

        rule call_params() -> Vec<Node>
            = expression() ++ (__* "," __*)

        rule if_statement() -> Node
            = p:pos() head:if_cond_block() tails:(__* x:elseif_parts() {x})? else_block:(__* x:else_part() {x})? {
                let cond_blocks = if let Some(x) = tails {
                    let mut items = vec![head];
                    items.extend(x);
                    items
                } else {
                    vec![head]
                };
                if_statement(cond_blocks, else_block).as_node(p)
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
            = p:pos() "loop" __* body:block() {
                loop_statement(body).as_node(p)
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

        rule pos() -> usize = p:position!() {
            p
        }
    }
}

pub fn parse(input: &str) -> Result<Vec<Node>, SyntaxError> {
    match uguisu_parser::root(input) {
        Ok(n) => Ok(n),
        Err(e) => Err(SyntaxError::new(
            format!("expects {}. ({})", e.expected, e.location).as_str(),
        )),
    }
}

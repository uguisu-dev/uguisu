use crate::SyntaxError;

#[cfg(test)]
mod test;

//
// node
//

#[derive(Debug, PartialEq)]
pub struct Node {
    pub inner: NodeInner,
    pub position: Option<usize>,
}

#[derive(Debug, PartialEq)]
pub enum NodeInner {
    // statement
    Declaration(Declaration),
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
    // function declaration
    Function(Function),
    FuncParam(FuncParam),
    // variable declaration
    Variable(Variable),
}

impl NodeInner {
    pub fn as_node(self, position: usize) -> Node {
        Node {
            inner: self,
            position: Some(position),
        }
    }

    pub fn as_node_internal(self) -> Node {
        Node {
            inner: self,
            position: None,
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct Declaration {
    pub body: Box<Node>,
}

impl Node {
    pub fn new_declaration(body: Node, position: usize) -> Self {
        NodeInner::Declaration(Declaration {
            body: Box::new(body),
        }).as_node(position)
    }
}

#[derive(Debug, PartialEq)]
pub struct Function {
    pub identifier: String,
    pub body: Option<Vec<Node>>,
    pub params: Vec<Node>,
    pub ret: Option<String>,
    pub attributes: Vec<FunctionAttribute>,
}

impl Node {
    pub fn new_function(
        identifier: String,
        body: Option<Vec<Node>>,
        params: Vec<Node>,
        ret: Option<String>,
        attributes: Vec<FunctionAttribute>,
        position: usize,
    ) -> Self {
        NodeInner::Function(Function {
            identifier,
            body,
            params,
            ret,
            attributes,
        }).as_node(position)
    }
}

#[derive(Debug, PartialEq)]
pub struct FuncParam {
    pub identifier: String,
    pub type_identifier: Option<String>,
}

impl Node {
    pub fn new_func_param(identifier: String, type_identifier: Option<String>, position: usize) -> Self {
        NodeInner::FuncParam(FuncParam {
            identifier,
            type_identifier,
        }).as_node(position)
    }
}

impl NodeInner {
    pub fn as_func_param(&self) -> &FuncParam {
        match self {
            NodeInner::FuncParam(x) => x,
            _ => panic!("function parameter expected"),
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum FunctionAttribute {
}

#[derive(Debug, PartialEq)]
pub struct Variable {
    pub identifier: String,
    pub body: Box<Node>,
    pub type_identifier: Option<String>,
    pub attributes: Vec<VariableAttribute>,
}

impl Node {
    pub fn new_variable(
        identifier: String,
        body: Node,
        type_identifier: Option<String>,
        attributes: Vec<VariableAttribute>,
        position: usize,
    ) -> Self {
        NodeInner::Variable(Variable {
            identifier,
            body: Box::new(body),
            type_identifier,
            attributes,
        }).as_node(position)
    }
}

#[derive(Debug, PartialEq)]
pub enum VariableAttribute {
    Const,
    Let,
}

impl Node {
    pub fn new_return_statement(expr: Option<Node>, position: usize) -> Self {
        match expr {
            Some(x) => NodeInner::ReturnStatement(Some(Box::new(x))).as_node(position),
            None => NodeInner::ReturnStatement(None).as_node(position),
        }
    }
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
    ModAssign,
}

impl Node {
    pub fn new_assignment(dest: Node, body: Node, mode: AssignmentMode, position: usize) -> Self {
        NodeInner::Assignment(Assignment {
            dest: Box::new(dest),
            body: Box::new(body),
            mode,
        }).as_node(position)
    }
}

#[derive(Debug, PartialEq)]
pub struct Reference {
    pub identifier: String,
}

impl Node {
    pub fn new_reference(identifier: &str, position: usize) -> Self {
        NodeInner::Reference(Reference {
            identifier: identifier.to_string(),
        }).as_node(position)
    }
}

#[derive(Debug, PartialEq)]
pub enum Literal {
    Number(i64),
    Bool(bool),
}

impl Node {
    pub fn new_number(value: i64, position: usize) -> Self {
        NodeInner::Literal(Literal::Number(value)).as_node(position)
    }

    pub fn new_bool(value: bool, position: usize) -> Self {
        NodeInner::Literal(Literal::Bool(value)).as_node(position)
    }
}

#[derive(Debug, PartialEq)]
pub struct BinaryExpr {
    pub operator: String,
    pub left: Box<Node>,
    pub right: Box<Node>,
}

impl Node {
    pub fn new_binary_expr(op: &str, left: Node, right: Node, position: usize) -> Self {
        NodeInner::BinaryExpr(BinaryExpr {
            operator: op.to_string(),
            left: Box::new(left),
            right: Box::new(right),
        }).as_node(position)
    }
}

#[derive(Debug, PartialEq)]
pub struct CallExpr {
    pub callee: Box<Node>,
    pub args: Vec<Node>,
}

impl Node {
    pub fn new_call_expr(callee: Node, args: Vec<Node>, position: usize) -> Self {
        NodeInner::CallExpr(CallExpr {
            callee: Box::new(callee),
            args,
        }).as_node(position)
    }
}

#[derive(Debug, PartialEq)]
pub struct IfStatement {
    pub cond_blocks: Vec<(Box<Node>, Vec<Node>)>, // if, else if
    pub else_block: Option<Vec<Node>>,            // else
}

impl Node {
    pub fn new_if_statement(cond_blocks: Vec<(Node, Vec<Node>)>, else_block: Option<Vec<Node>>, position: usize) -> Self {
        let mut items = Vec::new();
        for (cond, block) in cond_blocks {
            items.push((Box::new(cond), block))
        }
        NodeInner::IfStatement(IfStatement {
            cond_blocks: items,
            else_block,
        }).as_node(position)
    }
}

#[derive(Debug, PartialEq)]
pub struct LoopStatement {
    pub body: Vec<Node>, // statements
}

impl Node {
    pub fn new_loop_statement(body: Vec<Node>, position: usize) -> Self {
        NodeInner::LoopStatement(LoopStatement { body }).as_node(position)
    }
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
            left:(@) __* p:pos() "==" __* right:@ { Node::new_binary_expr("==", left, right, p) }
            left:(@) __* p:pos() "!=" __* right:@ { Node::new_binary_expr("!=", left, right, p) }
            --
            left:(@) __* p:pos() "<" __* right:@ { Node::new_binary_expr("<", left, right, p) }
            left:(@) __* p:pos() "<=" __* right:@ { Node::new_binary_expr("<=", left, right, p) }
            left:(@) __* p:pos() ">" __* right:@ { Node::new_binary_expr(">", left, right, p) }
            left:(@) __* p:pos() ">=" __* right:@ { Node::new_binary_expr(">=", left, right, p) }
            --
            left:(@) __* p:pos() "+" __* right:@ { Node::new_binary_expr("+", left, right, p) }
            left:(@) __* p:pos() "-" __* right:@ { Node::new_binary_expr("-", left, right, p) }
            --
            left:(@) __* p:pos() "*" __* right:@ { Node::new_binary_expr("*", left, right, p) }
            left:(@) __* p:pos() "/" __* right:@ { Node::new_binary_expr("/", left, right, p) }
            left:(@) __* p:pos() "%" __* right:@ { Node::new_binary_expr("%", left, right, p) }
            --
            // "!" __* right:(@) { right }
            // "+" __* right:(@) { right }
            // "-" __* right:(@) { Node::mult(Node::number(-1), right) }
            // --
            e:number() { e }
            e:bool() { e }
            e:call_expr() { e }
            p:pos() id:idenfitier() { Node::new_reference(id, p) }
            "(" __* e:expression() __* ")" { e }
        }

        rule function_declaration() -> Node =
            p:pos() attrs:func_dec_attrs()? "fn" __+ name:idenfitier() __* "(" __* params:func_dec_params()? __* ")"
            __* ret:func_dec_return_type()? __* body:func_dec_body()
        {
            let params = if let Some(v) = params { v } else { vec![] };
            let attrs = if let Some(v) = attrs { v } else { vec![] };
            let body = Node::new_function(name.to_string(), body, params, ret, attrs, p);
            Node::new_declaration(body, 0)
        }

        rule func_dec_params() -> Vec<Node>
            = func_dec_param() ++ (__* "," __*)

        rule func_dec_param() -> Node
            = p:pos() name:idenfitier() type_name:(__* ":" __* n:idenfitier() { n.to_string() })?
        { Node::new_func_param(name.to_string(), type_name, p) }

        rule func_dec_return_type() -> String
            = ":" __* type_name:idenfitier() { type_name.to_string() }

        rule func_dec_body() -> Option<Vec<Node>>
            = "{" __* s:statements()? __* "}" { Some(if let Some(v) = s { v } else { vec![] }) }
            / ";" { None }

        rule func_dec_attrs() -> Vec<FunctionAttribute> = "" { vec![] }
        // rule func_dec_attrs() -> Vec<FunctionAttribute>
        //     = attrs:(func_dec_attr() ++ (__+)) __+ { attrs }

        // rule func_dec_attr() -> FunctionAttribute
        //     = "" { }

        rule break_statement() -> Node
            = p:pos() "break" __* ";" { NodeInner::BreakStatement.as_node(p) }

        rule return_statement() -> Node
            = p:pos() "return" e2:(__+ e1:expression() { e1 })? __* ";" { Node::new_return_statement(e2, p) }

        rule variable_declaration() -> Node
            = p:pos() kind:(
                "let" {VariableAttribute::Let} / "const" {VariableAttribute::Const}
            ) __+ id:idenfitier() ty:(__* ":" __* x:idenfitier() {x.to_string()})? __* "=" __* e:expression() ";"
        {
            let body = Node::new_variable(id.to_string(), e, ty, vec![kind], p);
            Node::new_declaration(body, p)
        }

        rule assignment() -> Node
            = p:pos() id:idenfitier() __* mode:assignment_mode() __* e:expression() ";" {
                Node::new_assignment(Node::new_reference(id, p), e, mode, p)
            }

        rule assignment_mode() -> AssignmentMode
            = "=" { AssignmentMode::Assign }
            / "+=" { AssignmentMode::AddAssign }
            / "-=" { AssignmentMode::SubAssign }
            / "*=" { AssignmentMode::MultAssign }
            / "/=" { AssignmentMode::DivAssign }
            / "%=" { AssignmentMode::ModAssign }

        rule number() -> Node
            = quiet! {
                p:pos() n:$(['1'..='9'] ['0'..='9']+) {? n.parse().or(Err("u32")).and_then(|n| Ok(Node::new_number(n, p))) } }
            / quiet!{
                p:pos() n:$(['0'..='9']) {? n.parse().or(Err("u32")).and_then(|n| Ok(Node::new_number(n, p))) } }
            / expected!("number")

        rule bool() -> Node
            = p:pos() "true" { Node::new_bool(true, p) }
            / p:pos() "false" { Node::new_bool(false, p) }

        rule call_expr() -> Node
            = p:pos() name:idenfitier() __* "(" __* args:call_params()? __* ")"
        {
            let args = if let Some(v) = args { v } else { vec![] };
            Node::new_call_expr(Node::new_reference(name, p), args, p)
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
                Node::new_if_statement(cond_blocks, else_block, p)
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
                Node::new_loop_statement(body, p)
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

        rule comment_range()
            = "/*" (!"*/" [_])* "*/"

        rule comment_line()
            = "//" (!newline() [_])* newline()?

        rule newline() -> String
            = quiet! { "\r\n" { "\r\n".to_string() } / c:['\r'|'\n'] { c.to_string() } }

        rule __()
            = quiet! { [' '|'\t'|'\r'|'\n'] / comment_line() / comment_range() }

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

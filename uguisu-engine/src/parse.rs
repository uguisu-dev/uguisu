use crate::SyntaxError;

#[cfg(test)]
mod test;

//
// node
//

#[derive(Debug, PartialEq)]
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
    pub fn get_pos(&self) -> usize {
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

    /// supported newline characters: CR, CR+LF, LF
    pub fn calc_location(&self, code: &str) -> Result<(usize, usize), String> {
        let mut i = 0;
        let mut line = 1;
        let mut column = 1;
        let mut cr_flag = false;
        let mut iter = code.char_indices();
        loop {
            if i == self.get_pos() {
                return Ok((line, column));
            }
            // prepare next location
            let (next, char) = match iter.next() {
                Some((i, char)) => (i + char.len_utf8(), char),
                None => return Err("invalid location".to_string()),
            };
            i = next;
            match char {
                '\r' => { // CR
                    line += 1;
                    column = 1;
                    cr_flag = true;
                }
                '\n' => { // LF
                    if cr_flag {
                        cr_flag = false;
                    } else {
                        line += 1;
                        column = 1;
                    }
                }
                _ => {
                    if cr_flag {
                        cr_flag = false;
                        column += 1;
                    } else {
                        column += 1;
                    }
                }
            }
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct Declaration {
    pub body: Box<Node>,
    pub pos: usize,
}

impl Node {
    pub fn new_declaration(body: Node, pos: usize) -> Self {
        Self::Declaration(Declaration {
            body: Box::new(body),
            pos,
        })
    }
}

#[derive(Debug, PartialEq)]
pub struct BreakStatement {
    pub pos: usize,
}

impl Node {
    pub fn new_break_statement(pos: usize) -> Self {
        Self::BreakStatement(BreakStatement {
            pos,
        })
    }
}

#[derive(Debug, PartialEq)]
pub struct ReturnStatement {
    pub body: Option<Box<Node>>,
    pub pos: usize,
}

impl Node {
    pub fn new_return_statement(expr: Option<Node>, pos: usize) -> Self {
        match expr {
            Some(x) => Self::ReturnStatement(ReturnStatement { body: Some(Box::new(x)), pos }),
            None => Self::ReturnStatement(ReturnStatement { body: None, pos }),
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct Function {
    pub identifier: String,
    pub body: Option<Vec<Node>>,
    pub params: Vec<Node>,
    pub ret: Option<String>,
    pub attributes: Vec<FunctionAttribute>,
    pub pos: usize,
}

impl Node {
    pub fn new_function(
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
}

#[derive(Debug, PartialEq)]
pub struct FuncParam {
    pub identifier: String,
    pub type_identifier: Option<String>,
    pub pos: usize,
}

impl Node {
    pub fn new_func_param(identifier: String, type_identifier: Option<String>, pos: usize) -> Self {
        Self::FuncParam(FuncParam {
            identifier,
            type_identifier,
            pos,
        })
    }

    pub fn as_func_param(&self) -> &FuncParam {
        match self {
            Self::FuncParam(x) => x,
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
    pub pos: usize,
}

impl Node {
    pub fn new_variable(
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
    pub pos: usize,
}

impl Node {
    pub fn new_assignment(dest: Node, body: Node, mode: AssignmentMode, pos: usize) -> Self {
        Self::Assignment(Assignment {
            dest: Box::new(dest),
            body: Box::new(body),
            mode,
            pos,
        })
    }
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

#[derive(Debug, PartialEq)]
pub struct Reference {
    pub identifier: String,
    pub pos: usize,
}

impl Node {
    pub fn new_reference(identifier: &str, pos: usize) -> Self {
        Self::Reference(Reference {
            identifier: identifier.to_string(),
            pos,
        })
    }
}

#[derive(Debug, PartialEq)]
pub struct NumberLiteral {
    pub value: i64,
    pub pos: usize,
}

impl Node {
    pub fn new_number(value: i64, pos: usize) -> Self {
        Self::NumberLiteral(NumberLiteral { value, pos })
    }
}

#[derive(Debug, PartialEq)]
pub struct BoolLiteral {
    pub value: bool,
    pub pos: usize,
}

impl Node {
    pub fn new_bool(value: bool, pos: usize) -> Self {
        Self::BoolLiteral(BoolLiteral { value, pos })
    }
}

#[derive(Debug, PartialEq)]
pub struct BinaryExpr {
    pub operator: String,
    pub left: Box<Node>,
    pub right: Box<Node>,
    pub pos: usize,
}

impl Node {
    pub fn new_binary_expr(op: &str, left: Node, right: Node, pos: usize) -> Self {
        Self::BinaryExpr(BinaryExpr {
            operator: op.to_string(),
            left: Box::new(left),
            right: Box::new(right),
            pos,
        })
    }
}

#[derive(Debug, PartialEq)]
pub struct CallExpr {
    pub callee: Box<Node>,
    pub args: Vec<Node>,
    pub pos: usize,
}

impl Node {
    pub fn new_call_expr(callee: Node, args: Vec<Node>, pos: usize) -> Self {
        Self::CallExpr(CallExpr {
            callee: Box::new(callee),
            args,
            pos,
        })
    }
}

#[derive(Debug, PartialEq)]
pub struct IfStatement {
    pub cond_blocks: Vec<(Box<Node>, Vec<Node>)>, // if, else if
    pub else_block: Option<Vec<Node>>,            // else
    pub pos: usize,
}

impl Node {
    pub fn new_if_statement(cond_blocks: Vec<(Node, Vec<Node>)>, else_block: Option<Vec<Node>>, pos: usize) -> Self {
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
}

#[derive(Debug, PartialEq)]
pub struct LoopStatement {
    pub body: Vec<Node>, // statements
    pub pos: usize,
}

impl Node {
    pub fn new_loop_statement(body: Vec<Node>, pos: usize) -> Self {
        Self::LoopStatement(LoopStatement { body, pos })
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
            // "-" __* right:(@) { right }
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
            = p:pos() "break" __* ";" { Node::new_break_statement(p) }

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

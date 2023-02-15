use crate::SyntaxError;
use crate::ast::*;

#[cfg(test)]
mod test;

/// supported newline characters: CR, CR+LF, LF
pub(crate) fn calc_location(pos: usize, source_code: &str) -> Result<(usize, usize), String> {
    let mut i = 0;
    let mut line = 1;
    let mut column = 1;
    let mut cr_flag = false;
    let mut iter = source_code.char_indices();
    loop {
        if i == pos {
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

// NOTE: The ** operator may have bugs. Therefore, the ++ operator is used.

peg::parser! {
    grammar uguisu_parser() for str {
        pub(crate) rule root() -> Vec<Node>
            = __* s:statements()? __* { if let Some(v) = s { v } else { vec![] } }

        rule statements() -> Vec<Node>
            = statement() ++ (__*)

        pub(crate) rule statement() -> Node
            = function_declaration()
            / struct_declaration()
            / break_statement()
            / return_statement()
            / variable_declaration()
            / if_statement()
            / loop_statement()
            / assignment()
            / e:expression() __* ";" { e }

        pub(crate) rule expression() -> Node = precedence! {
            left:(@) __* p:pos() "||" __* right:@ { Node::new_binary_expr("||", left, right, p) }
            --
            left:(@) __* p:pos() "&&" __* right:@ { Node::new_binary_expr("&&", left, right, p) }
            --
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
            p:pos() "!" __* expr:(@) { Node::new_unary_op("!", expr, p) }
            // p:pos() "+" __* expr:(@) { Node::new_unary_op("+", expr, p) }
            // p:pos() "-" __* expr:(@) { Node::new_unary_op("-", expr, p) }
            --
            expr:expr_factor() field:(__* x:field_access() { x })? {
                /// build the field access chain
                /// ```text
                /// expr: "x", field: ["aaa", "bbb", "ccc"]
                ///     |
                ///     v
                /// "ccc" {
                ///     "bbb" {
                ///         "aaa" {
                ///             "x" { }
                ///         }
                ///     }
                /// }
                /// ```
                fn build_node(i: usize, segments: &Vec<(&str, usize)>, expr: Node) -> Node {
                    if i >= segments.len() {
                        expr
                    } else {
                        match segments.get(segments.len() - i - 1) {
                            Some(x) => {
                                Node::new_field_access(
                                    x.0.to_owned(),
                                    build_node(i + 1, segments, expr),
                                    x.1,
                                )
                            }
                            None => panic!(),
                        }
                    }
                }
                match field {
                    Some(x) => build_node(0, &x, expr),
                    None => expr,
                }
            }
        }

        rule expr_factor() -> Node
            = number()
            / bool()
            / string()
            / call_expr()
            / struct_expr()
            / p:pos() id:idenfitier() { Node::new_identifier(id, p) }
            / "(" __* e:expression() __* ")" { e }

        rule function_declaration() -> Node =
            p:pos() attrs:func_dec_attrs()? "fn" __+ name:idenfitier() __* "(" __* params:func_dec_params()? __* ")"
            __* ret:type_label()? __* body:func_dec_body()
        {
            let params = if let Some(v) = params { v } else { vec![] };
            let attrs = if let Some(v) = attrs { v } else { vec![] };
            Node::new_function_declaration(name.to_string(), body, params, ret, attrs, p)
        }

        rule func_dec_params() -> Vec<Node>
            = func_dec_param() ++ (__* "," __*)

        rule func_dec_param() -> Node
            = p:pos() name:idenfitier() type_name:(__* ":" __* n:idenfitier() { n.to_string() })?
        { Node::new_func_param(name.to_string(), type_name, p) }

        rule type_label() -> String
            = ":" __* type_name:idenfitier() { type_name.to_string() }

        rule func_dec_body() -> Option<Vec<Node>>
            = "{" __* s:statements()? __* "}" { Some(if let Some(v) = s { v } else { vec![] }) }
            / ";" { None }

        rule func_dec_attrs() -> Vec<FunctionAttribute> = "" { vec![] }
        // rule func_dec_attrs() -> Vec<FunctionAttribute>
        //     = attrs:(func_dec_attr() ++ (__+)) __+ { attrs }

        // rule func_dec_attr() -> FunctionAttribute
        //     = "" { }

        rule struct_declaration() -> Node =
            p:pos() "struct" __+ name:idenfitier() __* "{" __* body:(struct_decl_field() ++ (__*))? __* "}"
        {
            let body = match body {
                Some(x) => x,
                None => vec![],
            };
            Node::new_struct_declaration(name.to_string(), body, p)
        }

        rule struct_decl_field() -> Node =
            p:pos() name:idenfitier() __* type_name:type_label() __* ";"
        {
            Node::new_struct_decl_field(name.to_string(), type_name, p)
        }

        rule struct_expr() -> Node =
            p:pos() name:idenfitier() __* "{" __* body:(struct_expr_field() ++ (__* "," __*))? __* ("," __*)? "}"
        {
            let body = match body {
                Some(x) => x,
                None => vec![],
            };
            Node::new_struct_expr(name.to_string(), body, p)
        }

        rule struct_expr_field() -> Node =
            p:pos() name:idenfitier() __* ":" __* body:expression()
        {
            Node::new_struct_expr_field(name.to_string(), body, p)
        }

        rule break_statement() -> Node
            = p:pos() "break" __* ";" { Node::new_break_statement(p) }

        rule return_statement() -> Node
            = p:pos() "return" e2:(__+ e1:expression() { e1 })? __* ";" { Node::new_return_statement(e2, p) }

        rule variable_declaration() -> Node
            = p:pos() kind:(
                "var" {VariableAttribute::Var} / "const" {VariableAttribute::Const} / "let" {VariableAttribute::Let}
            ) __+ id:idenfitier() ty:(__* ":" __* x:idenfitier() {x.to_string()})? e:(__* "=" __* x:expression() {x})? __* ";"
        {
            Node::new_variable_declaration(id.to_string(), e, ty, vec![kind], p)
        }

        rule assignment() -> Node
            = p:pos() id:idenfitier() __* mode:assignment_mode() __* e:expression() ";" {
                Node::new_assignment(Node::new_identifier(id, p), e, mode, p)
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

        rule string() -> Node
            = p:pos() "\"" value:string_element()* "\"" { Node::new_string(value.iter().collect(), p) }

        rule string_element() -> char
            = "\\r" { '\r' }
            / "\\n" { '\n' }
            / "\\t" { '\t' }
            / !"\"" c:[_] { c }

        rule call_expr() -> Node
            = p:pos() name:idenfitier() __* "(" __* args:call_params()? __* ")"
        {
            let args = if let Some(v) = args { v } else { vec![] };
            Node::new_call_expr(Node::new_identifier(name, p), args, p)
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

        rule field_access() -> Vec<(&'input str, usize)>
            = field_access_segment() ++ (__*)

        rule field_access_segment() -> (&'input str, usize)
            = "." __* p:pos() name:idenfitier()
        {
            (name, p)
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

pub(crate) struct Parser<'a> {
    source_code: &'a str,
}

impl<'a> Parser<'a> {
    pub(crate) fn new(source_code: &'a str) -> Self {
        Self {
            source_code,
        }
    }

    pub(crate) fn parse(&self) -> Result<Vec<Node>, SyntaxError> {
        match uguisu_parser::root(self.source_code) {
            Ok(n) => Ok(n),
            Err(e) => Err(SyntaxError::new(
                format!("expects {}. ({})", e.expected, e.location).as_str(),
            )),
        }
    }
}

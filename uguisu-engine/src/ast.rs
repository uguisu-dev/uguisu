use crate::parse;

#[derive(Debug, PartialEq)]
pub enum Node {
    // statement
    FunctionDeclaration(FunctionDeclaration),
    VariableDeclaration(VariableDeclaration),
    StructDeclaration(StructDeclaration),
    BreakStatement(BreakStatement),
    ReturnStatement(ReturnStatement),
    Assignment(Assignment),
    IfStatement(IfStatement),
    LoopStatement(LoopStatement),
    // expression
    Identifier(Identifier),
    NumberLiteral(NumberLiteral),
    BoolLiteral(BoolLiteral),
    StringLiteral(StringLiteral),
    BinaryExpr(BinaryExpr),
    UnaryOp(UnaryOp),
    CallExpr(CallExpr),
    StructExpr(StructExpr),
    FieldAccess(FieldAccess),
    // function declaration
    FuncParam(FuncParam),
    // struct declaration
    StructDeclField(StructDeclField),
    // struct expr
    StructExprField(StructExprField),
}

impl Node {
    pub fn get_name(&self) -> &str {
        match self {
            Node::FunctionDeclaration(_) => "FunctionDeclaration",
            Node::VariableDeclaration(_) => "VariableDeclaration",
            Node::StructDeclaration(_) => "StructDeclaration",
            Node::StructExpr(_) => "StructExpr",
            Node::BreakStatement(_) => "BreakStatement",
            Node::ReturnStatement(_) => "ReturnStatement",
            Node::Assignment(_) => "Assignment",
            Node::IfStatement(_) => "IfStatement",
            Node::LoopStatement(_) => "LoopStatement",
            Node::Identifier(_) => "Identifier",
            Node::NumberLiteral(_) => "NumberLiteral",
            Node::BoolLiteral(_) => "BoolLiteral",
            Node::StringLiteral(_) => "StringLiteral",
            Node::BinaryExpr(_) => "BinaryExpr",
            Node::UnaryOp(_) => "UnaryOp",
            Node::CallExpr(_) => "CallExpr",
            Node::FuncParam(_) => "FuncParam",
            Node::FieldAccess(_) => "FieldAccess",
            Node::StructDeclField(_) => "StructDeclField",
            Node::StructExprField(_) => "StructExprField",
        }
    }

    pub fn get_pos(&self) -> usize {
        match self {
            Node::FunctionDeclaration(node) => node.pos,
            Node::VariableDeclaration(node) => node.pos,
            Node::StructDeclaration(node) => node.pos,
            Node::StructExpr(node) => node.pos,
            Node::BreakStatement(node) => node.pos,
            Node::ReturnStatement(node) => node.pos,
            Node::Assignment(node) => node.pos,
            Node::IfStatement(node) => node.pos,
            Node::LoopStatement(node) => node.pos,
            Node::Identifier(node) => node.pos,
            Node::NumberLiteral(node) => node.pos,
            Node::BoolLiteral(node) => node.pos,
            Node::StringLiteral(node) => node.pos,
            Node::BinaryExpr(node) => node.pos,
            Node::UnaryOp(node) => node.pos,
            Node::CallExpr(node) => node.pos,
            Node::FuncParam(node) => node.pos,
            Node::FieldAccess(node) => node.pos,
            Node::StructDeclField(node) => node.pos,
            Node::StructExprField(node) => node.pos,
        }
    }

    pub fn new_function_declaration(
        identifier: String,
        body: Option<Vec<Node>>,
        params: Vec<Node>,
        ret: Option<String>,
        attributes: Vec<FunctionAttribute>,
        pos: usize,
    ) -> Self {
        Node::FunctionDeclaration(FunctionDeclaration {
            identifier,
            body,
            params,
            ret,
            attributes,
            pos,
        })
    }

    pub fn new_func_param(identifier: String, type_identifier: Option<String>, pos: usize) -> Self {
        Node::FuncParam(FuncParam {
            identifier,
            type_identifier,
            pos,
        })
    }

    pub fn new_variable_declaration(
        identifier: String,
        body: Option<Node>,
        type_identifier: Option<String>,
        attributes: Vec<VariableAttribute>,
        pos: usize,
    ) -> Self {
        let body = match body {
            Some(x) => Some(Box::new(x)),
            None => None,
        };
        Node::VariableDeclaration(VariableDeclaration {
            identifier,
            body,
            type_identifier,
            attributes,
            pos,
        })
    }

    pub fn new_struct_declaration(
        identifier: String,
        fields: Vec<Node>,
        pos: usize,
    ) -> Self {
        Node::StructDeclaration(StructDeclaration {
            identifier,
            fields,
            pos,
        })
    }

    pub fn new_struct_decl_field(identifier: String, type_identifier: String, pos: usize) -> Self {
        Node::StructDeclField(StructDeclField {
            identifier,
            type_identifier,
            pos,
        })
    }

    pub fn new_struct_expr(
        identifier: String,
        fields: Vec<Node>,
        pos: usize,
    ) -> Self {
        Node::StructExpr(StructExpr {
            identifier,
            fields,
            pos,
        })
    }

    pub fn new_struct_expr_field(identifier: String, body: Node, pos: usize) -> Self {
        Node::StructExprField(StructExprField {
            identifier,
            body: Box::new(body),
            pos,
        })
    }

    pub fn new_break_statement(pos: usize) -> Self {
        Node::BreakStatement(BreakStatement {
            pos,
        })
    }

    pub fn new_return_statement(expr: Option<Node>, pos: usize) -> Self {
        match expr {
            Some(x) => Node::ReturnStatement(ReturnStatement { body: Some(Box::new(x)), pos }),
            None => Node::ReturnStatement(ReturnStatement { body: None, pos }),
        }
    }

    pub fn new_assignment(dest: Node, body: Node, mode: AssignmentMode, pos: usize) -> Self {
        Node::Assignment(Assignment {
            dest: Box::new(dest),
            body: Box::new(body),
            mode,
            pos,
        })
    }

    pub fn new_if_statement(cond_blocks: Vec<(Node, Vec<Node>)>, else_block: Option<Vec<Node>>, pos: usize) -> Self {
        let mut items = Vec::new();
        for (cond, block) in cond_blocks {
            items.push((Box::new(cond), block))
        }
        Node::IfStatement(IfStatement {
            cond_blocks: items,
            else_block,
            pos,
        })
    }

    pub fn new_loop_statement(body: Vec<Node>, pos: usize) -> Self {
        Node::LoopStatement(LoopStatement { body, pos })
    }

    pub fn new_identifier(value: &str, pos: usize) -> Self {
        Node::Identifier(Identifier {
            value: value.to_string(),
            pos,
        })
    }

    pub fn new_number(value: i64, pos: usize) -> Self {
        Node::NumberLiteral(NumberLiteral { value, pos })
    }

    pub fn new_bool(value: bool, pos: usize) -> Self {
        Node::BoolLiteral(BoolLiteral { value, pos })
    }

    pub fn new_string(value: String, pos: usize) -> Self {
        Node::StringLiteral(StringLiteral { value, pos })
    }

    pub fn new_binary_expr(op: &str, left: Node, right: Node, pos: usize) -> Self {
        Node::BinaryExpr(BinaryExpr {
            operator: op.to_string(),
            left: Box::new(left),
            right: Box::new(right),
            pos,
        })
    }

    pub fn new_unary_op(op: &str, expr: Node, pos: usize) -> Self {
        Node::UnaryOp(UnaryOp {
            operator: op.to_string(),
            expr: Box::new(expr),
            pos,
        })
    }

    pub fn new_call_expr(callee: Node, args: Vec<Node>, pos: usize) -> Self {
        Node::CallExpr(CallExpr {
            callee: Box::new(callee),
            args,
            pos,
        })
    }

    pub fn new_field_access(
        identifier: String,
        target: Node,
        pos: usize,
    ) -> Self {
        Node::FieldAccess(FieldAccess {
            identifier,
            target: Box::new(target),
            pos,
        })
    }

    pub fn as_func_param(&self) -> &FuncParam {
        match self {
            Node::FuncParam(x) => x,
            _ => panic!("function parameter expected"),
        }
    }

    pub fn as_struct_decl_field(&self) -> &StructDeclField {
        match self {
            Node::StructDeclField(x) => x,
            _ => panic!("struct decl field expected"),
        }
    }

    pub fn as_struct_expr_field(&self) -> &StructExprField {
        match self {
            Node::StructExprField(x) => x,
            _ => panic!("struct expr field expected"),
        }
    }

    pub fn as_identifier(&self) -> &Identifier {
        match self {
            Node::Identifier(x) => x,
            _ => panic!("identifier expected"),
        }
    }

    pub fn as_field_access(&self) -> &FieldAccess {
        match self {
            Node::FieldAccess(x) => x,
            _ => panic!("field access expected"),
        }
    }

    pub fn as_field_access_mut(&mut self) -> &mut FieldAccess {
        match self {
            Node::FieldAccess(x) => x,
            _ => panic!("field access expected"),
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
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub enum FunctionAttribute {
}

#[derive(Debug, PartialEq)]
pub struct FuncParam {
    pub identifier: String,
    pub type_identifier: Option<String>,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct VariableDeclaration {
    pub identifier: String,
    pub type_identifier: Option<String>,
    pub attributes: Vec<VariableAttribute>,
    pub body: Option<Box<Node>>,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct StructDeclaration {
    pub identifier: String,
    pub fields: Vec<Node>, // StructDeclField
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct StructDeclField {
    pub identifier: String,
    pub type_identifier: String,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct StructExpr {
    pub identifier: String,
    pub fields: Vec<Node>, // StructExprField
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct StructExprField {
    pub identifier: String,
    pub body: Box<Node>, // expression
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub enum VariableAttribute {
    Const,
    Var,
    Let, // NOTE: compatibility
}

#[derive(Debug, PartialEq)]
pub struct BreakStatement {
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct ReturnStatement {
    pub body: Option<Box<Node>>,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct Assignment {
    pub dest: Box<Node>,
    pub body: Box<Node>,
    pub mode: AssignmentMode,
    pub pos: usize,
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
pub struct IfStatement {
    pub cond_blocks: Vec<(Box<Node>, Vec<Node>)>, // if, else if
    pub else_block: Option<Vec<Node>>,            // else
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct LoopStatement {
    pub body: Vec<Node>, // statements
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct Identifier {
    pub value: String,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct NumberLiteral {
    pub value: i64,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct BoolLiteral {
    pub value: bool,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct StringLiteral {
    pub value: String,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct BinaryExpr {
    pub operator: String,
    pub left: Box<Node>,
    pub right: Box<Node>,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct UnaryOp {
    pub operator: String,
    pub expr: Box<Node>,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct CallExpr {
    pub callee: Box<Node>,
    pub args: Vec<Node>,
    pub pos: usize,
}

#[derive(Debug, PartialEq)]
pub struct FieldAccess {
    pub identifier: String,
    pub target: Box<Node>,
    pub pos: usize,
}

fn indent(indent: usize) -> String {
    let mut buf = String::new();
    for _ in 0..indent*2 {
        buf.push(' ');
    }
    buf
}

pub(crate) fn show_tree(nodes: &Vec<Node>, source_code: &str, level: usize) {
    for node in nodes.iter() {
        show_node(node, source_code, level);
    }
}

fn show_node(node: &Node, source_code: &str, level: usize) {
    let name = node.get_name();
    let (line, column) = parse::calc_location(node.get_pos(), source_code).unwrap();
    println!("{}{} ({}:{}) {{", indent(level), name, line, column);
    match node {
        Node::FunctionDeclaration(node) => {
            println!("{}identifier: \"{}\"", indent(level + 1), node.identifier);

            println!("{}attributes: {{", indent(level + 1));
            for attr in node.attributes.iter() {
                println!("{}{:?}", indent(level + 2), attr);
            }
            println!("{}}}", indent(level + 1));

            println!("{}params: {{", indent(level + 1));
            show_tree(&node.params, source_code, level + 2);
            println!("{}}}", indent(level + 1));

            match &node.ret {
                Some(x) => {
                    println!("{}ret: \"{}\"", indent(level + 1), x);
                }
                None => {
                    println!("{}ret: (None)", indent(level + 1));
                }
            }

            println!("{}body: {{", indent(level + 1));
            match &node.body {
                Some(x) => {
                    show_tree(x, source_code, level + 2);
                }
                None => {
                    println!("{}(None)", indent(level + 2));
                }
            }
            println!("{}}}", indent(level + 1));
        }
        Node::VariableDeclaration(node) => {
            println!("{}identifier: \"{}\"", indent(level + 1), node.identifier);

            println!("{}attributes: {{", indent(level + 1));
            for attr in node.attributes.iter() {
                println!("{}{:?}", indent(level + 2), attr);
            }
            println!("{}}}", indent(level + 1));

            match &node.type_identifier {
                Some(x) => {
                    println!("{}type_identifier: \"{}\"", indent(level + 1), x);
                }
                None => {
                    println!("{}type_identifier: (None)", indent(level + 1));
                }
            }

            println!("{}body: {{", indent(level + 1));
            match &node.body {
                Some(x) => {
                    show_node(x, source_code, level + 2);
                }
                None => {
                    println!("{}(None)", indent(level + 2));
                }
            }
            println!("{}}}", indent(level + 1));
        }
        Node::StructDeclaration(node) => {
            println!("{}identifier: \"{}\"", indent(level + 1), node.identifier);
            println!("{}fields: {{", indent(level + 1));
            show_tree(&node.fields, source_code, level + 2);
            println!("{}}}", indent(level + 1));
        }
        Node::StructExpr(node) => {
            println!("{}identifier: \"{}\"", indent(level + 1), node.identifier);
            println!("{}fields: {{", indent(level + 1));
            show_tree(&node.fields, source_code, level + 2);
            println!("{}}}", indent(level + 1));
        }
        Node::BreakStatement(_) => {}
        Node::ReturnStatement(node) => {
            println!("{}body: {{", indent(level + 1));
            match &node.body {
                Some(x) => {
                    show_node(x, source_code, level + 2);
                }
                None => {
                    println!("{}(None)", indent(level + 2));
                }
            }
            println!("{}}}", indent(level + 1));
        }
        Node::Assignment(node) => {
            println!("{}node: {:?}", indent(level + 1), node.mode);

            println!("{}dest: {{", indent(level + 1));
            show_node(&node.dest, source_code, level + 2);
            println!("{}}}", indent(level + 1));

            println!("{}body: {{", indent(level + 1));
            show_node(&node.body, source_code, level + 2);
            println!("{}}}", indent(level + 1));
        }
        Node::IfStatement(node) => {
            println!("{}cond_blocks: {{", indent(level + 1));
            for (cond, body) in node.cond_blocks.iter() {
                println!("{}cond_block: {{", indent(level + 2));
                println!("{}cond: {{", indent(level + 3));
                show_node(cond, source_code, level + 4);
                println!("{}}}", indent(level + 3));

                println!("{}body: {{", indent(level + 3));
                show_tree(body, source_code, level + 4);
                println!("{}}}", indent(level + 3));
                println!("{}}}", indent(level + 2));
            }
            println!("{}}}", indent(level + 1));

            println!("{}else_block: {{", indent(level + 1));
            match &node.else_block {
                Some(x) => {
                    show_tree(x, source_code, level + 2);
                }
                None => {
                    println!("{}(None)", indent(level + 2));
                }
            }
            println!("{}}}", indent(level + 1));
        }
        Node::LoopStatement(node) => {
            println!("{}body: {{", indent(level + 1));
            show_tree(&node.body, source_code, level + 2);
            println!("{}}}", indent(level + 1));
        }
        Node::Identifier(node) => {
            println!("{}identifier: \"{}\"", indent(level + 1), node.value);
        }
        Node::NumberLiteral(node) => {
            println!("{}value: {:?}", indent(level + 1), node.value);
        }
        Node::BoolLiteral(node) => {
            println!("{}value: {:?}", indent(level + 1), node.value);
        }
        Node::StringLiteral(node) => {
            println!("{}value: \"{}\"", indent(level + 1), node.value);
        }
        Node::BinaryExpr(node) => {
            println!("{}operator: \"{}\"", indent(level + 1), node.operator);

            println!("{}left: {{", indent(level + 1));
            show_node(&node.left, source_code, level + 2);
            println!("{}}}", indent(level + 1));

            println!("{}right: {{", indent(level + 1));
            show_node(&node.right, source_code, level + 2);
            println!("{}}}", indent(level + 1));
        }
        Node::UnaryOp(node) => {
            println!("{}operator: \"{}\"", indent(level + 1), node.operator);

            println!("{}expr: {{", indent(level + 1));
            show_node(&node.expr, source_code, level + 2);
            println!("{}}}", indent(level + 1));
        }
        Node::CallExpr(node) => {
            println!("{}callee: {{", indent(level + 1));
            show_node(&node.callee, source_code, level + 2);
            println!("{}}}", indent(level + 1));

            println!("{}args: {{", indent(level + 1));
            show_tree(&node.args, source_code, level + 2);
            println!("{}}}", indent(level + 1));
        }
        Node::FuncParam(node) => {
            println!("{}identifier: \"{}\"", indent(level + 1), node.identifier);

            match &node.type_identifier {
                Some(x) => {
                    println!("{}type_identifier: \"{}\"", indent(level + 1), x);
                }
                None => {
                    println!("{}type_identifier: (None)", indent(level + 1));
                }
            }
        }
        Node::FieldAccess(node) => {
            println!("{}identifier: \"{}\"", indent(level + 1), node.identifier);
            println!("{}target: {{", indent(level + 1));
            show_node(&node.target, source_code, level + 2);
            println!("{}}}", indent(level + 1));
        }
        Node::StructDeclField(node) => {
            println!("{}identifier: \"{}\"", indent(level + 1), node.identifier);
            println!("{}type_identifier: \"{}\"", indent(level + 1), node.type_identifier);
        }
        Node::StructExprField(node) => {
            println!("{}identifier: \"{}\"", indent(level + 1), node.identifier);
        }
    }
    println!("{}}}", indent(level));
}

use crate::ast;

#[derive(Debug, Clone)]
pub enum Node<'a> {
    Statement(&'a ast::Statement),
    Expression(&'a ast::Expression),
}

pub fn visit(node: Node, callback: fn(&Node) -> bool) {
    if !callback(&node) {
        return;
    }
    match node {
        Node::Statement(statement) => match statement {
            ast::Statement::ReturnStatement(Some(expr)) => {
                visit(Node::Expression(expr), callback);
            }
            ast::Statement::ReturnStatement(None) => {}
            ast::Statement::VariableDeclaration(statement) => {
                visit(Node::Expression(&statement.body), callback);
            }
            ast::Statement::Assignment(statement) => {
                visit(Node::Expression(&statement.body), callback);
            }
            ast::Statement::FunctionDeclaration(decl) => {
                if let Some(body) = &decl.body {
                    for statement in body.iter() {
                        visit(Node::Statement(statement), callback);
                    }
                }
            }
            ast::Statement::ExprStatement(expr) => {
                visit(Node::Expression(expr), callback);
            }
        },
        Node::Expression(expr) => match expr {
            ast::Expression::BinaryExpr(op) => {
                visit(Node::Expression(&op.left), callback);
                visit(Node::Expression(&op.right), callback);
            }
            ast::Expression::CallExpr(call_expr) => {
                for arg in call_expr.args.iter() {
                    visit(Node::Expression(arg), callback);
                }
            }
            ast::Expression::Identifier(_) => {}
            ast::Expression::Literal(literal) => match literal {
                ast::Literal::Number(_) => {}
            },
        },
    }
}

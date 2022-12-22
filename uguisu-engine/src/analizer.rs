use crate::ast::{self, Literal};
use crate::errors::CompileError;

fn analyze_visitor(node: &VisitorNode) -> bool {
    match node {
        VisitorNode::Statement(ast::Statement::FunctionDeclaration(func_decl)) => {
            return true; // walk body
        }
        _ => {},
    }
    false
}

pub fn analyze(ast: &Vec<ast::Statement>) -> Result<(), CompileError> {
    for statement in ast.iter() {
        visit(VisitorNode::Statement(statement), analyze_visitor);
    }
    Ok(())
}

#[derive(Debug, Clone)]
enum VisitorNode<'a> {
    Statement(&'a ast::Statement),
    Expression(&'a ast::Expression),
}

fn visit(node: VisitorNode, visitor: fn(&VisitorNode) -> bool) {
    if !visitor(&node) {
        return;
    }
    match node {
        VisitorNode::Statement(statement) => {
            match statement {
                ast::Statement::ReturnStatement(Some(expr)) => {
                    visit(VisitorNode::Expression(expr), visitor);
                }
                ast::Statement::ReturnStatement(None) => {}
                ast::Statement::VariableDeclaration(statement) => {
                    visit(VisitorNode::Expression(&statement.body), visitor);
                }
                ast::Statement::Assignment(statement) => {
                    visit(VisitorNode::Expression(&statement.body), visitor);
                }
                ast::Statement::FunctionDeclaration(decl) => {
                    if let Some(body) = &decl.body {
                        for statement in body.iter() {
                            visit(VisitorNode::Statement(statement), visitor);
                        }
                    }
                }
                ast::Statement::ExprStatement(expr) => {
                    visit(VisitorNode::Expression(expr), visitor);
                }
            }
        }
        VisitorNode::Expression(expr) => {
            match expr {
                ast::Expression::BinaryExpr(op) => {
                    visit(VisitorNode::Expression(&op.left), visitor);
                    visit(VisitorNode::Expression(&op.right), visitor);
                }
                ast::Expression::CallExpr(call_expr) => {
                    for arg in call_expr.args.iter() {
                        visit(VisitorNode::Expression(arg), visitor);
                    }
                }
                ast::Expression::Identifier(_) => {}
                ast::Expression::Literal(literal) => match literal {
                    Literal::Number(_) => {}
                },
            }
        }
    }
}

use crate::ast;
use crate::errors::CompileError;
use self::visitor::{Node, visit};

mod visitor;

pub fn analyze(ast: &Vec<ast::Statement>) -> Result<(), CompileError> {
    for statement in ast.iter() {
        visit(Node::Statement(statement), analyze_visitor);
    }
    Ok(())
}

fn analyze_visitor(node: &Node) -> bool {
    match node {
        Node::Statement(ast::Statement::FunctionDeclaration(func_decl)) => {
            println!("{}", func_decl.identifier);
            return true; // walk body
        }
        _ => {},
    }
    false
}

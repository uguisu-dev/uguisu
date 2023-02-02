use crate::graph::{self, FunctionBody};
use super::Analyzer;

pub(crate) fn show_node(analyzer: &Analyzer, node_ref: graph::NodeRef) {
    let node = node_ref.get(analyzer.source);
    let name = match node {
        graph::Node::FunctionDeclaration(_) => "FunctionDeclaration",
        graph::Node::VariableDeclaration(_) => "VariableDeclaration",
        graph::Node::BreakStatement(_) => "BreakStatement",
        graph::Node::ReturnStatement(_) => "ReturnStatement",
        graph::Node::Assignment(_) => "Assignment",
        graph::Node::IfStatement(_) => "IfStatement",
        graph::Node::LoopStatement(_) => "LoopStatement",
        graph::Node::Reference(_) => "Reference",
        graph::Node::Literal(_) => "Literal",
        graph::Node::RelationalOp(_) => "RelationalOp",
        graph::Node::LogicalBinaryOp(_) => "LogicalBinaryOp",
        graph::Node::ArithmeticOp(_) => "ArithmeticOp",
        graph::Node::LogicalUnaryOp(_) => "LogicalUnaryOp",
        graph::Node::CallExpr(_) => "CallExpr",
        graph::Node::FuncParam(_) => "FuncParam",
    };
    let (line, column) = node.get_pos();
    println!("[{}] {} ({}:{})", node_ref.id, name, line, column);
    match node {
        graph::Node::FunctionDeclaration(func) => {
            println!("  name: {}", func.identifier);
            println!("  params: {{");
            for param in func.params.iter() {
                println!("    [{}]", param.id);
            }
            println!("  }}");
            match &func.body {
                Some(FunctionBody::Statements(body)) => {
                    println!("  body: {{");
                    for item in body.iter() {
                        println!("    [{}]", item.id);
                    }
                    println!("  }}");
                }
                Some(FunctionBody::NativeCode) => {
                    println!("  body: (native code)");
                }
                None => {
                    println!("  body: (None)");
                }
            }
        }
        graph::Node::VariableDeclaration(variable) => {
            println!("  name: {}", variable.identifier);
            println!("  body: {{");
            println!("    [{}]", variable.body.id);
            println!("  }}");
        }
        graph::Node::BreakStatement(_) => {}
        graph::Node::ReturnStatement(node) => {
            match node.body {
                Some(x) => {
                    println!("  expr: {{");
                    println!("    [{}]", x.id);
                    println!("  }}");
                }
                None => {
                    println!("  expr: (None)");
                }
            }
        }
        graph::Node::Assignment(statement) => {
            println!("  dest: {{");
            println!("    [{}]", statement.dest.id);
            println!("  }}");
            println!("  body: {{");
            println!("    [{}]", statement.body.id);
            println!("  }}");
        }
        graph::Node::IfStatement(if_statement) => {
            println!("  condition: {{");
            println!("    [{}]", if_statement.condition.id);
            println!("  }}");
            println!("  then_block: {{");
            for item in if_statement.then_block.iter() {
                println!("    [{}]", item.id);
            }
            println!("  }}");
            println!("  else_block: {{");
            for item in if_statement.else_block.iter() {
                println!("    [{}]", item.id);
            }
            println!("  }}");
        }
        graph::Node::LoopStatement(statement) => {
            println!("  body: {{");
            for item in statement.body.iter() {
                println!("    [{}]", item.id);
            }
            println!("  }}");
        }
        graph::Node::Reference(x) => {
            println!("  dest: {{");
            println!("    [{}]", x.dest.id);
            println!("  }}");
        }
        graph::Node::Literal(literal) => {
            println!("  value: {:?}", literal.value);
        }
        graph::Node::RelationalOp(expr) => {
            println!("  operator: {:?}", expr.operator);
            println!("  left: {{");
            println!("    [{}]", expr.left.id);
            println!("  }}");
            println!("  right: {{");
            println!("    [{}]", expr.right.id);
            println!("  }}");
        },
        graph::Node::LogicalBinaryOp(expr) => {
            println!("  operator: {:?}", expr.operator);
            println!("  left: {{");
            println!("    [{}]", expr.left.id);
            println!("  }}");
            println!("  right: {{");
            println!("    [{}]", expr.right.id);
            println!("  }}");
        },
        graph::Node::ArithmeticOp(expr) => {
            println!("  operator: {:?}", expr.operator);
            println!("  left: {{");
            println!("    [{}]", expr.left.id);
            println!("  }}");
            println!("  right: {{");
            println!("    [{}]", expr.right.id);
            println!("  }}");
        },
        graph::Node::LogicalUnaryOp(op) => {
            println!("  operator: {:?}", op.operator);
            println!("  expr: {{");
            println!("    [{}]", op.expr.id);
            println!("  }}");
        },
        graph::Node::CallExpr(call_expr) => {
            println!("  callee: {{");
            println!("    [{}]", call_expr.callee.id);
            println!("  }}");
            println!("  args: {{");
            for arg in call_expr.args.iter() {
                println!("    [{}]", arg.id);
            }
            println!("  }}");
        }
        graph::Node::FuncParam(func_param) => {
            println!("  name: {}", func_param.identifier);
        }
    }
}

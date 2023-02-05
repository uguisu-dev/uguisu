use crate::run::RuningStack;
use std::collections::HashMap;

mod analyze;
mod graph;
mod types;
mod parse;
mod ast;
mod run;

#[cfg(test)]
mod test;

pub struct SyntaxError {
    pub message: String,
}

impl SyntaxError {
    pub(crate) fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

pub struct RuntimeError {
    pub message: String,
}

impl RuntimeError {
    pub(crate) fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

pub struct Engine {
    graph_source: HashMap<graph::NodeId, graph::Node>,
    analyzing_trace: bool,
    running_trace: bool,
}

impl Engine {
    pub fn new(analyzing_trace: bool, running_trace: bool) -> Self {
        Self {
            graph_source: HashMap::new(),
            analyzing_trace,
            running_trace,
        }
    }

    pub fn parse(&self, code: &str) -> Result<Vec<ast::Node>, SyntaxError> {
        parse::parse(code)
    }

    pub fn show_ast(&self, ast: &Vec<ast::Node>, code: &str) {
        ast::show_tree(ast, code, 0);
    }

    pub fn analyze(&mut self, code: &str, ast: Vec<ast::Node>) -> Result<Vec<graph::NodeRef>, SyntaxError> {
        let mut analyzer = analyze::Analyzer::new(code, &mut self.graph_source, self.analyzing_trace);
        analyzer.translate(&ast)
    }

    pub fn show_graph_map(&mut self) {
        graph::show_map(&self.graph_source);
    }

    pub fn run(&mut self, graph: Vec<graph::NodeRef>) -> Result<(), RuntimeError> {
        let mut stack = RuningStack::new(self.running_trace);
        let runner = run::Runner::new(&self.graph_source, self.running_trace);
        runner.run(&graph, &mut stack)
    }
}

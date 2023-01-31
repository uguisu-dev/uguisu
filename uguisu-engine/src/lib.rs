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
}

impl Engine {
    pub fn new() -> Self {
        Self {
            graph_source: HashMap::new(),
        }
    }

    pub fn parse(&self, code: &str) -> Result<Vec<ast::Node>, SyntaxError> {
        parse::parse(code)
    }

    pub fn analyze(&mut self, code: &str, ast: Vec<ast::Node>) -> Result<Vec<graph::NodeRef>, SyntaxError> {
        let mut analyzer = analyze::Analyzer::new(code, &mut self.graph_source);
        analyzer.translate(&ast)
    }

    pub fn show_graph_map(&mut self) {
        let analyzer = analyze::Analyzer::new("", &mut self.graph_source);
        analyzer.show_graph();
    }

    pub fn run(&mut self, graph: Vec<graph::NodeRef>) -> Result<(), RuntimeError> {
        let mut stack = RuningStack::new();
        let runner = run::Runner::new(&self.graph_source);
        runner.run(&graph, &mut stack)
    }
}

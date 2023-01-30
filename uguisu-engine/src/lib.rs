use crate::run::RuningStack;
use std::collections::HashMap;

mod analyze;
mod parse;
mod run;

#[cfg(test)]
mod test;

#[derive(Debug)]
pub struct SyntaxError {
    pub message: String,
}

impl SyntaxError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

pub struct RuntimeError {
    pub message: String,
}

impl RuntimeError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_string(),
        }
    }
}

pub struct Engine {
    graph_source: HashMap<analyze::NodeId, analyze::Node>,
}

impl Engine {
    pub fn new() -> Self {
        Self {
            graph_source: HashMap::new(),
        }
    }

    pub fn parse(&self, code: &str) -> Result<Vec<parse::Node>, SyntaxError> {
        parse::parse(code)
    }

    pub fn analyze(&mut self, code: &str, ast: Vec<parse::Node>) -> Result<Vec<analyze::NodeRef>, SyntaxError> {
        let mut analyzer = analyze::Analyzer::new(code, &mut self.graph_source);
        analyzer.translate(&ast)
    }

    pub fn show_graph_map(&mut self) {
        let analyzer = analyze::Analyzer::new("", &mut self.graph_source);
        analyzer.show_graph();
    }

    pub fn run(&mut self, graph: Vec<analyze::NodeRef>) -> Result<(), RuntimeError> {
        let mut stack = RuningStack::new();
        let runner = run::Runner::new(&self.graph_source);
        runner.run(&graph, &mut stack)
    }
}

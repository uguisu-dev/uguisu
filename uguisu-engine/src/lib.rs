mod ast;
mod parse;
mod hir;
mod hir_generate;
mod hir_run;

#[cfg(test)]
mod test;

use hir::SymbolTable;

use crate::hir_run::RuningStack;
use std::collections::HashMap;

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
    hir_source: HashMap<hir::NodeId, hir::Node>,
    symbol_table: SymbolTable,
    analysis_trace: bool,
    running_trace: bool,
}

impl Engine {
    pub fn new(analysis_trace: bool, running_trace: bool) -> Self {
        Self {
            hir_source: HashMap::new(),
            symbol_table: SymbolTable::new(),
            analysis_trace,
            running_trace,
        }
    }

    pub fn parse(&self, code: &str) -> Result<Vec<ast::Node>, SyntaxError> {
        parse::parse(code)
    }

    pub fn show_ast(&self, ast: &Vec<ast::Node>, code: &str) {
        ast::show_tree(ast, code, 0);
    }

    pub fn generate_hir(&mut self, code: &str, ast: Vec<ast::Node>) -> Result<Vec<hir::NodeRef>, SyntaxError> {
        self.symbol_table.set_trace(self.analysis_trace);
        let mut analyzer = hir_generate::Analyzer::new(code, &mut self.hir_source, &mut self.symbol_table, self.analysis_trace);
        let result = analyzer.generate(&ast);
        self.symbol_table.set_trace(false);
        result
    }

    pub fn show_hir_map(&mut self) {
        hir::show_map(&self.hir_source, &self.symbol_table);
    }

    pub fn run(&mut self, hir_code: Vec<hir::NodeRef>) -> Result<(), RuntimeError> {
        let mut stack = RuningStack::new(self.running_trace);
        let runner = hir_run::Runner::new(&self.hir_source, &self.symbol_table, self.running_trace);
        runner.run(&hir_code, &mut stack)
    }
}

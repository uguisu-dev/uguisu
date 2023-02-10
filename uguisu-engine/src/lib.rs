//! This crate is a execution engine for Uguisu.
//!
//! ## Data flow
//! ```text
//! [source code]
//!       |
//!       V
//!    parse()
//!       |
//!       | AST data
//!       V
//! generate_hir()
//!       |
//!       | HIR data
//!       V
//!      run()
//! ```

pub mod ast;
mod parse;
pub mod hir;
mod hir_generate;
mod hir_run;
mod builtin;

#[cfg(test)]
mod test;

use hir::SymbolTable;
use hir_generate::HirGenerator;
use hir_run::HirRunner;
use parse::Parser;
use crate::hir_run::Env;
use std::collections::BTreeMap;

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

pub struct AstData<'a> {
    pub content: Vec<ast::Node>,
    pub source_code: &'a str,
}

pub struct HirData {
    pub content: Vec<hir::NodeRef>,
    pub node_map: BTreeMap<hir::NodeId, hir::Node>,
    pub symbol_table: SymbolTable,
}

pub fn parse(source_code: &str) -> Result<AstData, SyntaxError> {
    let parser = Parser::new(source_code);
    let parse_result = parser.parse()?;
    Ok(AstData {
        content: parse_result,
        source_code,
    })
}

pub fn show_ast_data(ast_data: &AstData) {
    ast::show_tree(&ast_data.content, ast_data.source_code, 0);
}

pub fn generate_hir(ast_data: &AstData, trace: bool) -> Result<HirData, SyntaxError> {
    let mut node_map = BTreeMap::new();
    let mut symbol_table = SymbolTable::new();
    symbol_table.set_trace(trace);
    let mut generator = HirGenerator::new(
        ast_data.source_code,
        &ast_data.content,
        &mut node_map,
        &mut symbol_table,
        trace,
    );
    let generate_result = generator.generate()?;
    symbol_table.set_trace(false);
    Ok(HirData {
        content: generate_result,
        node_map,
        symbol_table,
    })
}

pub fn show_hir_data(hir_data: &HirData) {
    hir::show_map(&hir_data.node_map, &hir_data.symbol_table);
}

pub fn run(hir_data: &HirData, trace: bool) -> Result<(), RuntimeError> {
    let runner = HirRunner::new(&hir_data.node_map, &hir_data.symbol_table, trace);
    let mut env = Env::new(trace);
    runner.run(&hir_data.content, &mut env)
}

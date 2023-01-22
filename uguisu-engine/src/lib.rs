use std::collections::HashMap;

use crate::run::SymbolTable;

mod analyze;
mod parse;
mod run;

#[cfg(test)]
mod test;

pub fn run(code: &str) -> Result<(), String> {
    println!("[Info] parsing ...");
    let ast = parse::parse(code).map_err(|e| format!("Syntax Error: {}", e.message))?;

    println!("[Info] code analyzing ...");
    let mut graph_source: HashMap<analyze::NodeId, analyze::Node> = HashMap::new();
    let mut analyzer = analyze::Analyzer::new(&mut graph_source);
    let graph = analyzer
        .translate(&ast)
        .map_err(|e| format!("Syntax Error: {}", e.message))?;

    //println!("[Info] show graph");
    //analyzer.show_graph();

    println!("[Info] running ...");
    let mut symbols = SymbolTable::new();
    let runner = run::Runner::new(&graph_source);
    runner.run(&graph, &mut symbols).map_err(|e| format!("Runtime Error: {}", e.message))?;

    Ok(())
}

mod compiler;
mod jit;
mod parser;

fn main() {
  compiler::run("let abc = 1 + 1;");
}

mod compiler;
mod jit;
mod parser;

fn main() {
  compiler::run("
  fn main() {
    const abc = 10 + 2;
    return abc;
  }
  ");
}

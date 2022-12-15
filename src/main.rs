mod engine;

fn main() {
  engine::run("
  external fn hello();

  fn main() {
    hello();
    return;
  }
  ");
}

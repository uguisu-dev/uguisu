mod engine;

fn main() {
  engine::run("
  fn main() {
    return;
  }
  ");
}

mod engine;

fn main() {
  engine::run("
  fn main() {
    const abc = 10 + 2;
    return abc;
  }
  ");
}

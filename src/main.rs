mod engine;

fn main() {
    engine::run("
    external fn hello();

    fn main() {
        const abc = 1 + 1;
        hello();
        return;
    }
    ");
}

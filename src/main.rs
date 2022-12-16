mod engine;

fn main() {
    engine::run("
    external fn print_num(value: number);

    fn add(x: number, y: number): number {
        return x + y;
    }

    fn main() {
        print_num(add(1, 2) * 3);
    }
    ");
}

mod engine;

fn main() {
    match engine::run("
    external fn print_num(value: number);

    fn add(x: number, y: number): number {
        return x + y;
    }

    fn main() {
        print_num(add(1, 2) * 3);
    }
    ") {
        Ok(_) => {},
        Err(e) => { println!("{}", e); },
    };
}

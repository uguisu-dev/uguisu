use uguisu_cli;

fn main() {
    const STACK_SIZE: usize = 512 * 1024 * 1024;
    std::thread::Builder::new()
        .stack_size(STACK_SIZE)
        .spawn(run_thread)
        .unwrap()
        .join()
        .unwrap();
}

fn run_thread() {
    uguisu_cli::parse_command();
}

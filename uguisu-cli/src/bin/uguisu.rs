fn main() {
    let builder = std::thread::Builder::new()
        .name(String::from("uguisu"))
        .stack_size(8 * 1024 * 1024);
    let join_handle = builder
        .spawn(sub_thread)
        .unwrap();
    join_handle.join()
        .unwrap();
}

fn sub_thread() {
    uguisu_cli::process_command();
}

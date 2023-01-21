# uguisu-lang
A Execution engine for the Uguisu lang.  
Not ready to use yet.

The syntax is like this:
```
external fn print_num(value: number);

fn add(x: number, y: number): number {
    return x + y;
}

fn main() {
    print_num(add(1, 2) * 3);
}
```

## Run the example code
```
cargo run example.ug
```

## Test
```
cargo test
```

## License
MIT License

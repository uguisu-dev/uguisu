# uguisu-lang
Uguisu lang

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

## Run the experimental code
```
cargo run
```

## Test
```
cargo test
```

## License
MIT

# uguisu-lang
A Execution engine for the Uguisu lang.  
Not ready to use yet.

The syntax is like this:
```
external fn print_num(value: number);

fn calc(x: number): number {
    if x == 0 {
        return 1;
    } else {
        return calc(x - 1) * 2;
    }
}

fn main() {
    print_num(calc(10));
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

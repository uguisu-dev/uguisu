- 関数宣言
  - 引数の型は明示しなければならない。
  - 戻り値の型は明示しなければならない。
    - 指定されない場合は`void`型として扱われる。
  - (静的解析) 指定した戻り値の型の値が返されない場合はエラーとする。

```
fn add(x: number, y: number): number {
    return x + y;
}

fn main() {
    var x: number = add(1, 2);
}
```

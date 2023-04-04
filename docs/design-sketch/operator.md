## 二項演算子
- 演算子の左側の式から型を推論する。

```
var x: number = 1 + 2;
// 3
```

```
var x: bool = (1 == 1);
// true
```

```
var x: bool = (1 < 2);
// true
```

```
var x: bool;
x = (true && true);
// true
x = (true || false);
// true
```
- `e1 || e2`の演算でe1を評価した結果がtrueの場合はe2の評価は行われない。

## 単項演算子
```
var x: bool = !true;
// false
```

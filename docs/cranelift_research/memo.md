## 変数
> let x = Variable::new(index);

変数を作成


> builder.declare_var(x, type::I32);

変数宣言


> builder.use_var(x);

変数の値を読み取る


> builder.def_var(x, value);

変数の値を書き込む
変数は複数の定義を持つことができることに注意する。
Cranelift はそれらを自動的に SSA 形式に変換する。


## ジャンプ

> builder.ins().jump(block, &[]);

ブロックを指定してジャンプする


> builder.ins().brnz(arg, block, &[]);

非ゼロで分岐する


## その他

> builder.seal_block(block);

要調査
ブロック切り替え直後に使うことが多いみたい。

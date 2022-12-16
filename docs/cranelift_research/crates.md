# cranelift_module
## Structs
FunctionDeclaration      呼び出すことができる関数に関する情報。
ModuleCompiledFunction   コンパイルされた関数に関する情報。
ModuleDeclarations       ir::ExternalNames を FunctionDeclarations と DataDeclarations に変換できるようにするモジュールにより、状態のビューを提供します。
ModuleReloc              モジュールの再配置。
TrapSite                 cranelift が TrapSink::trap に渡す引数のレコード。
## Enums
FuncOrDataId             宣言された名前は、関数またはデータ宣言のいずれかを参照できます。
Linkage                  エンティティが定義されている場所と、それを誰が見ることができるかを指定できます。
ModuleExtName            処理できるグローバルなものに変換された ExternalName。
ModuleError              すべてのModule メソッドのエラー メッセージ。
Init                     データの初期化方法を指定します。
## Traits
Module                   モジュールは、関数とデータ オブジェクトを収集し、それらをリンクするためのユーティリティです。
## Functions
default_libcall_names    ir::LibCalls のデフォルト名。 この名前の関数は、ir::ExternalName::LibCall バリアントの変換の一部としてオブジェクトにインポートされます。
## Type Definitions
ModuleResult             ModuleError をエラーの種類として使用するための Result の便利機能。

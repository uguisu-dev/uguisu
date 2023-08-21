export enum Token {
    EOF,
    Ident,
    Literal,

    /** "+" */
    Plus,
    /** "-" */
    Minus,
    /** "*" */
    Asterisk,
    /** "/" */
    Slash,
    /** "%" */
    Percent,
    /** "{" */
    BeginBrace,
    /** "}" */
    EndBrace,
    /** "(" */
    BeginParen,
    /** ")" */
    EndParen,
    /** "[" */
    BeginBracket,
    /** "]" */
    EndBracket,
    /** "." */
    Dot,
    /** "," */
    Comma,
    /** ":" */
    Colon,
    /** ";" */
    Semi,
    /** "=" */
    Assign,
    /** "+=" */
    AddAssign,
    /** "-=" */
    SubAssign,
    /** "*=" */
    MultAssign,
    /** "/=" */
    DivAssign,
    /** "%=" */
    ModAssign,
    /** "==" */
    Eq2,
    /** ">" */
    GreaterThan,
    /** ">=" */
    GreaterThanEq,
    /** "<" */
    LessThan,
    /** "<=" */
    LessThanEq,
    /** "!" */
    Not,
    /** "!=" */
    NotEq,
    /** "|" */
    Or,
    /** "&" */
    And,
    /** "||" */
    Or2,
    /** "&&" */
    And2,

    /** "as" */
    As,
    /** "async" */
    Async,
    /** "await" */
    Await,
    /** "break" */
    Break,
    /** "class" */
    Class,
    /** "const" */
    Const,
    /** "continue" */
    Continue,
    /** "else" */
    Else,
    /** "enum" */
    Enum,
    /** "export" */
    Export,
    /** "feature" */
    Feature,
    /** "fn" */
    Fn,
    /** "for" */
    For,
    /** "if" */
    If,
    /** "import" */
    Import,
    /** "interface" */
    Inferface,
    /** "loop" */
    Loop,
    /** "match" */
    Match,
    /** "namespace" */
    Namespace,
    /** "new" */
    New,
    /** "public" */
    Public,
    /** "return" */
    Return,
    /** "sizeof" */
    Sizeof,
    /** "struct" */
    Struct,
    /** "switch" */
    Switch,
    /** "this" */
    This,
    /** "type" */
    Type,
    /** "typeof" */
    Typeof,
    /** "var" */
    Var,
}

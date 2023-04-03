export type Pos = [number, number];

export type AstNode
    = SourceFile
    | FileNode
    | StatementNode
    | TyLabel
    | FnDeclParam
    | StructDeclField
    | StructExprField;

export type FileNode = FunctionDecl | StructDecl;

export type StatementCoreNode
    = VariableDecl
    | AssignStatement
    | IfStatement
    | LoopStatement
    | ReturnStatement
    | BreakStatement;

export type StatementNode
    = StatementCoreNode
    | ExprNode;

export type ExprNode
    = NumberLiteral
    | BoolLiteral
    | CharLiteral
    | StringLiteral
    | BinaryOp
    | UnaryOp
    | Identifier
    | Call
    | StructExpr
    | FieldAccess
    | ArrayNode
    | IndexAccess;

export type ReferenceExpr
    = Identifier
    | FieldAccess
    | IndexAccess;

export type NodeOf<T extends AstNode['kind']>
    = T extends 'SourceFile' ? SourceFile
    : T extends 'FunctionDecl' ? FunctionDecl
    : T extends 'FnDeclParam' ? FnDeclParam
    : T extends 'IfStatement' ? IfStatement
    : T extends 'Identifier' ? Identifier
    : T extends 'NumberLiteral' ? NumberLiteral
    : T extends 'BoolLiteral' ? BoolLiteral
    : T extends 'CharLiteral' ? CharLiteral
    : T extends 'StringLiteral' ? StringLiteral
    : T extends 'UnaryOp' ? UnaryOp
    : T extends 'BinaryOp' ? BinaryOp
    : T extends 'Call' ? Call
    : T extends 'TyLabel' ? TyLabel
    : T extends 'BreakStatement' ? BreakStatement
    : T extends 'ContinueStatement' ? ContinueStatement
    : T extends 'ReturnStatement' ? ReturnStatement
    : T extends 'LoopStatement' ? LoopStatement
    : T extends 'AssignStatement' ? AssignStatement
    : T extends 'VariableDecl' ? VariableDecl
    : T extends 'StructDeclField' ? StructDeclField
    : T extends 'StructExprField' ? StructExprField
    : T extends 'StructDecl' ? StructDecl
    : T extends 'StructExpr' ? StructExpr
    : T extends 'FieldAccess' ? FieldAccess
    : T extends 'ArrayNode' ? ArrayNode
    : T extends 'IndexAccess' ? IndexAccess
    : never;

const exprNodeKind: AstNode['kind'][] = [
    'NumberLiteral', 'BoolLiteral', 'CharLiteral', 'StringLiteral', 'BinaryOp', 'UnaryOp', 'Identifier', 'Call', 'StructExpr',
    'FieldAccess', 'ArrayNode', 'IndexAccess',
];
export function isExprNode(node: AstNode): node is ExprNode {
    return exprNodeKind.includes(node.kind);
}

export type SourceFile = {
    kind: 'SourceFile',
    pos: Pos;
    filename: string;
    decls: FileNode[],
};
export function createSourceFile(pos: Pos, filename: string, decls: FileNode[]): SourceFile {
    return { kind: 'SourceFile', pos, filename, decls };
}

export type FunctionDecl = {
    kind: 'FunctionDecl',
    pos: Pos;
    name: string,
    params: FnDeclParam[],
    body: StatementNode[],
    returnTy?: TyLabel,
    exported: boolean,
};
export function createFunctionDecl(
    pos: Pos,
    name: string,
    params: FnDeclParam[],
    body: StatementNode[],
    returnTy: TyLabel | undefined,
    exported: boolean,
): FunctionDecl {
    return { kind: 'FunctionDecl', pos, name, params, body, returnTy, exported };
}

export type FnDeclParam = {
    kind: 'FnDeclParam',
    pos: Pos;
    name: string;
    ty?: TyLabel;
};
export function createFnDeclParam(pos: Pos, name: string, ty?: TyLabel): FnDeclParam {
    return { kind: 'FnDeclParam', pos, name, ty };
}

export type IfStatement = {
    kind: 'IfStatement',
    pos: Pos;
    cond: ExprNode;
    thenBlock: StatementNode[];
    elseBlock: StatementNode[];
};
export function createIfStatement(
    pos: Pos,
    cond: ExprNode,
    thenBlock: StatementNode[],
    elseBlock: StatementNode[],
): IfStatement {
    return { kind: 'IfStatement', pos, cond, thenBlock, elseBlock };
}

export type Identifier = {
    kind: 'Identifier',
    pos: Pos;
    name: string,
};
export function createIdentifier(pos: Pos, name: string): Identifier {
    return { kind: 'Identifier', pos, name };
}

export type NumberLiteral = {
    kind: 'NumberLiteral',
    pos: Pos;
    value: number,
};
export function createNumberLiteral(pos: Pos, value: number): NumberLiteral {
    return { kind: 'NumberLiteral', pos, value };
}

export type BoolLiteral = {
    kind: 'BoolLiteral',
    pos: Pos;
    value: boolean,
};
export function createBoolLiteral(pos: Pos, value: boolean): BoolLiteral {
    return { kind: 'BoolLiteral', pos, value };
}

export type CharLiteral = {
    kind: 'CharLiteral',
    pos: Pos;
    value: string,
};
export function createCharLiteral(pos: Pos, value: string): CharLiteral {
    return { kind: 'CharLiteral', pos, value };
}

export type StringLiteral = {
    kind: 'StringLiteral',
    pos: Pos;
    value: string,
};
export function createStringLiteral(pos: Pos, value: string): StringLiteral {
    return { kind: 'StringLiteral', pos, value };
}

export type UnaryOp = {
    kind: 'UnaryOp',
    pos: Pos;
    operator: UnaryOperator,
    expr: ExprNode,
};
export function createUnaryOp(pos: Pos, operator: UnaryOperator, expr: ExprNode): UnaryOp {
    return { kind: 'UnaryOp', pos, operator, expr };
}
export type UnaryOperator = LogicalUnaryOperator;
export type LogicalUnaryOperator = '!';

export type BinaryOp = {
    kind: 'BinaryOp',
    pos: Pos;
    operator: BinaryOperator,
    left: ExprNode,
    right: ExprNode,
};
export function createBinaryOp(
    pos: Pos,
    operator: BinaryOperator,
    left: ExprNode,
    right: ExprNode,
): BinaryOp {
    return { kind: 'BinaryOp', pos, operator, left, right };
}

export type BinaryOperator =
    LogicalBinaryOperator | EquivalentOperator | OrderingOperator | ArithmeticOperator;

export type LogicalBinaryOperator = '||' | '&&';
const logicalBinaryOperators: BinaryOperator[] = ['||', '&&'];

export function isLogicalBinaryOperator(x: BinaryOperator): x is LogicalBinaryOperator {
    return logicalBinaryOperators.includes(x);
}

export type EquivalentOperator = '==' | '!=';
const equivalentOperators: BinaryOperator[] = ['==', '!='];

export function isEquivalentOperator(x: BinaryOperator): x is EquivalentOperator {
    return equivalentOperators.includes(x);
}

export type OrderingOperator = '<' |'<=' | '>' | '>=';
const orderingOperators: BinaryOperator[] = ['<', '<=', '>', '>='];

export function isOrderingOperator(x: BinaryOperator): x is OrderingOperator {
    return orderingOperators.includes(x);
}

export type ArithmeticOperator = '+' | '-' | '*' | '/' | '%';
const arithmeticOperators: BinaryOperator[] = ['+', '-', '*', '/', '%'];

export function isArithmeticOperator(x: BinaryOperator): x is ArithmeticOperator {
    return arithmeticOperators.includes(x);
}

export type Call = {
    kind: 'Call',
    pos: Pos;
    callee: ExprNode,
    args: ExprNode[],
};
export function createCall(pos: Pos, callee: ExprNode, args: ExprNode[]): Call {
    return { kind: 'Call', pos, callee, args };
}

export type TyLabel = {
    kind: 'TyLabel',
    pos: Pos;
    name: string,
};
export function createTyLabel(pos: Pos, name: string): TyLabel {
    return { kind: 'TyLabel', pos, name };
}

export type BreakStatement = {
    kind: 'BreakStatement',
    pos: Pos,
};
export function createBreakStatement(pos: Pos): BreakStatement {
    return { kind: 'BreakStatement', pos };
}

export type ContinueStatement = {
    kind: 'ContinueStatement',
    pos: Pos,
};
export function createContinueStatement(pos: Pos): ContinueStatement {
    return { kind: 'ContinueStatement', pos };
}

export type ReturnStatement = {
    kind: 'ReturnStatement',
    pos: Pos,
    expr?: ExprNode,
};
export function createReturnStatement(pos: Pos, expr?: ExprNode): ReturnStatement {
    return { kind: 'ReturnStatement', pos, expr };
}

export type LoopStatement = {
    kind: 'LoopStatement',
    pos: Pos,
    block: StatementNode[],
};
export function createLoopStatement(pos: Pos, block: StatementNode[]): LoopStatement {
    return { kind: 'LoopStatement', pos, block };
}

export type AssignMode = '=' | '+=' | '-=' | '*=' | '/=' | '%=';

export type AssignStatement = {
    kind: 'AssignStatement',
    pos: Pos,
    target: ExprNode,
    body: ExprNode,
    mode: AssignMode,
};
export function createAssignStatement(
    pos: Pos,
    target: ExprNode,
    body: ExprNode,
    mode: AssignMode,
): AssignStatement {
    return { kind: 'AssignStatement', pos, target, body, mode };
}

export type VariableDecl = {
    kind: 'VariableDecl',
    pos: Pos,
    name: string,
    ty?: TyLabel,
    body?: ExprNode,
};
export function createVariableDecl(pos: Pos, name: string, ty?: TyLabel, body?: ExprNode): VariableDecl {
    return { kind: 'VariableDecl', pos, name, ty, body };
}

// struct

export type StructDecl = {
    kind: 'StructDecl',
    pos: Pos,
    name: string,
    fields: StructDeclField[],
    exported: boolean,
};
export function createStructDecl(pos: Pos, name: string, fields: StructDeclField[], exported: boolean): StructDecl {
    return { kind: 'StructDecl', pos, name, fields, exported };
}

export type StructDeclField = {
    kind: 'StructDeclField',
    pos: Pos,
    name: string,
    ty: TyLabel,
};
export function createStructDeclField(pos: Pos, name: string, ty: TyLabel): StructDeclField {
    return { kind: 'StructDeclField', pos, name, ty };
}

export type StructExpr = {
    kind: 'StructExpr',
    pos: Pos,
    name: string,
    fields: StructExprField[],
};
export function createStructExpr(pos: Pos, name: string, fields: StructExprField[]): StructExpr {
    return { kind: 'StructExpr', pos, name, fields };
}

export type StructExprField = {
    kind: 'StructExprField',
    pos: Pos,
    name: string,
    body: ExprNode,
};
export function createStructExprField(pos: Pos, name: string, body: ExprNode): StructExprField {
    return { kind: 'StructExprField', pos, name, body };
}

export type FieldAccess = {
    kind: 'FieldAccess',
    pos: Pos,
    name: string,
    target: ExprNode,
};
export function createFieldAccess(pos: Pos, name: string, target: ExprNode): FieldAccess {
    return { kind: 'FieldAccess', pos, name, target };
}

// array

export type ArrayNode = {
    kind: 'ArrayNode',
    pos: Pos,
    items: ExprNode[],
};
export function createArrayNode(pos: Pos, items: ExprNode[]): ArrayNode {
    return { kind: 'ArrayNode', pos, items };
}

export type IndexAccess = {
    kind: 'IndexAccess',
    pos: Pos,
    target: ExprNode,
    index: ExprNode,
};
export function createIndexAccess(pos: Pos, target: ExprNode, index: ExprNode): IndexAccess {
    return { kind: 'IndexAccess', pos, target, index };
}

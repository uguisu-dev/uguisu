export type Pos = [number, number];

export type AstNode = SourceFile | FileNode | StatementNode | ExprNode;
export type FileNode = FunctionDecl;
export type StatementNode = IfStatement;
export type ExprNode = Identifier | NumberLiteral;

export type SourceFile = {
	kind: 'SourceFile',
	pos: Pos;
	funcs: FunctionDecl[],
};
export function newSourceFile(pos: Pos, funcs: FunctionDecl[]): SourceFile {
	return { kind: 'SourceFile', pos, funcs };
}

export type FunctionDecl = {
	kind: 'FunctionDecl',
	pos: Pos;
	name: string,
};
export function newFunctionDecl(pos: Pos, name: string): FunctionDecl {
	return { kind: 'FunctionDecl', pos, name };
}

export type IfStatement = {
	kind: 'IfStatement',
	pos: Pos;
	cond: AstNode;
	thenBlock: AstNode[];
	elseBlock: AstNode[];
};
export function newIfStatement(pos: Pos, cond: AstNode, thenBlock: AstNode[], elseBlock: AstNode[]): IfStatement {
	return { kind: 'IfStatement', pos, cond, thenBlock, elseBlock };
}

export type Identifier = {
	kind: 'Identifier',
	pos: Pos;
	name: string,
};
export function newIdentifier(pos: Pos, name: string): Identifier {
	return { kind: 'Identifier', pos, name };
}

export type NumberLiteral = {
	kind: 'NumberLiteral',
	pos: Pos;
	value: number,
};
export function newNumberLiteral(pos: Pos, value: number): NumberLiteral {
	return { kind: 'NumberLiteral', pos, value };
}

export type Pos = [number, number];

export type AstNode = SourceFile | FileNode | StatementNode | TyLabel;
export type FileNode = FunctionDecl;
export type StatementNode = VariableDecl | AssignStatement | IfStatement | LoopStatement | ReturnStatement | BreakStatement | ExprNode;
export type ExprNode = Identifier | NumberLiteral;

export type SourceFile = {
	kind: 'SourceFile',
	pos: Pos;
	filename: string;
	funcs: FunctionDecl[],
};
export function newSourceFile(pos: Pos, filename: string, funcs: FunctionDecl[]): SourceFile {
	return { kind: 'SourceFile', pos, filename, funcs };
}

export type FunctionDecl = {
	kind: 'FunctionDecl',
	pos: Pos;
	name: string,
	returnTy?: TyLabel,
};
export function newFunctionDecl(pos: Pos, name: string, returnTy?: TyLabel): FunctionDecl {
	return { kind: 'FunctionDecl', pos, name, returnTy };
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

export type TyLabel = {
	kind: 'TyLabel',
	pos: Pos;
	name: string,
};
export function newTyLabel(pos: Pos, name: string): TyLabel {
	return { kind: 'TyLabel', pos, name };
}

export type BreakStatement = {
	kind: 'BreakStatement',
	pos: Pos,
};
export function newBreakStatement(pos: Pos): BreakStatement {
	return { kind: 'BreakStatement', pos };
}

export type ReturnStatement = {
	kind: 'ReturnStatement',
	pos: Pos,
	expr?: ExprNode,
};
export function newReturnStatement(pos: Pos, expr?: ExprNode): ReturnStatement {
	return { kind: 'ReturnStatement', pos, expr };
}

export type LoopStatement = {
	kind: 'LoopStatement',
	pos: Pos,
	block: StatementNode[],
};
export function newLoopStatement(pos: Pos, block: StatementNode[]): LoopStatement {
	return { kind: 'LoopStatement', pos, block };
}

export enum AssignMode {
	Assign,
}

export type AssignStatement = {
	kind: 'AssignStatement',
	pos: Pos,
	name: Identifier,
	body: ExprNode,
	mode: AssignMode,
};
export function newAssignStatement(pos: Pos, name: Identifier, body: ExprNode, mode: AssignMode): AssignStatement {
	return { kind: 'AssignStatement', pos, name, body, mode };
}

export type VariableDecl = {
	kind: 'VariableDecl',
	pos: Pos,
	name: Identifier,
	ty?: TyLabel,
	body?: ExprNode,
};
export function newVariableDecl(pos: Pos, name: Identifier, ty?: TyLabel, body?: ExprNode): VariableDecl {
	return { kind: 'VariableDecl', pos, name, ty, body };
}

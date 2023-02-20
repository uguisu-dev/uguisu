export enum AstNodeKind {
	Identifier,
	Number,
	IfStatement,
}

export interface AstNode {
	kind: AstNodeKind;
	pos: number;
}

export interface IdentifierNode extends AstNode {
	kind: AstNodeKind.Identifier;
	name: string;
}

export function makeIdentifier(name: string, pos: number): IdentifierNode {
	return { kind: AstNodeKind.Identifier, name, pos };
}

export interface NumberNode extends AstNode {
	kind: AstNodeKind.Number;
	value: number;
}

export function makeNumber(value: number, pos: number): NumberNode {
	return { kind: AstNodeKind.Number, value, pos };
}

export interface IfStatementNode extends AstNode {
	kind: AstNodeKind.IfStatement;
	cond: AstNode;
	thenBlock: AstNode[];
	elseBlock: AstNode[];
}

export function makeIfStatement(cond: AstNode, thenBlock: AstNode[], elseBlock: AstNode[], pos: number): IfStatementNode {
	return { kind: AstNodeKind.IfStatement, cond, thenBlock, elseBlock, pos };
}

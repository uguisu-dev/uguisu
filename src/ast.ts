export enum AstNodeKind {
	Identifier,
	Number,
}

export interface AstNode {
	kind: AstNodeKind;
	pos: number;
}

export interface IdentifierNode extends AstNode {
	kind: AstNodeKind.Identifier;
	name: string;
}

export interface NumberNode extends AstNode {
	kind: AstNodeKind.Number;
	value: string;
}

export function makeIdentifier(name: string, pos: number): IdentifierNode {
	return { kind: AstNodeKind.Identifier, name, pos };
}

export function makeNumber(value: string, pos: number): NumberNode {
	return { kind: AstNodeKind.Number, value, pos };
}

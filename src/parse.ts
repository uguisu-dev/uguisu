import { Token, TokenKind } from './tokenize';

enum AstNodeKind {
	Identifier,
	Number,
}

interface AstNode {
	kind: AstNodeKind;
	pos: number;
}

interface IdentifierNode extends AstNode {
	kind: AstNodeKind.Identifier;
	name: string;
}

interface NumberNode extends AstNode {
	kind: AstNodeKind.Number;
	value: string;
}

export function makeIdentifier(name: string, pos: number): IdentifierNode {
	return { kind: AstNodeKind.Identifier, name, pos };
}

export function makeNumber(value: string, pos: number): NumberNode {
	return { kind: AstNodeKind.Number, value, pos };
}

function expectNumber(index: number, input: Token[]): string {
	const token = input[index];
	if (token.kind != TokenKind.Digits) {
		throw new Error(`Digits is expected (index: ${token.pos})`);
	}
	return token.value;
}

function expectIdent(index: number, input: Token[]): string {
	const token = input[index];
	if (token.kind != TokenKind.Identifier) {
		throw new Error(`Identifier is expected (index: ${token.pos})`);
	}
	return token.value;
}

export function parse(offset: number, input: Token[]): AstNode[] {
	let result;
	let index = offset;
	let accum: AstNode[] = [];
	while (index < input.length) {
		const token = input[index];

		result = parseExpr(index, input);
		if (result != null) {
			accum.push(result[0]);
			index++;
			continue;
		}

		if (token.kind == TokenKind.Identifier) {
			const node = makeIdentifier(token.value, token.pos);
			accum.push(node);
			index++;
			continue;
		}

		throw new Error(`syntax error (index: ${token.pos})`);
	}

	return accum;
}

export function parseExpr(offset: number, input: Token[]): [AstNode, number] | null {
	let index = offset;
	const token = input[index];

	if (token.kind == TokenKind.Digits) {
		const node = makeNumber(token.value, token.pos);
		index++;
		return [node, index];
	}

	if (token.kind == TokenKind.Identifier) {
		const node = makeIdentifier(token.value, token.pos);
		index++;
		return [node, index];
	}

	return null;
}

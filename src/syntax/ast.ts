export interface AstNode {
	pos: number;
}

abstract class AstNodeBase implements AstNode {
	pos: number;

	constructor(pos: number) {
		this.pos = pos;
	}
}

export class SourceFile extends AstNodeBase {
	funcs: FunctionDecl[];

	constructor(funcs: FunctionDecl[]) {
		super(0);
		this.funcs = funcs;
	}
}
export function isSourceFile(x: AstNode): x is SourceFile {
	return x instanceof SourceFile;
}

export class FunctionDecl extends AstNodeBase {
	name: string;

	constructor(name: string, pos: number) {
		super(pos);
		this.name = name;
	}
}
export function isFunctionDecl(x: AstNode): x is FunctionDecl {
	return x instanceof FunctionDecl;
}

export class Identifier extends AstNodeBase {
	name: string;

	constructor(name: string, pos: number) {
		super(pos);
		this.name = name;
	}
}
export function isIdentifier(x: AstNode): x is Identifier {
	return x instanceof Identifier;
}

export class Number extends AstNodeBase {
	value: number;

	constructor(value: number, pos: number) {
		super(pos);
		this.value = value;
	}
}
export function isNumber(x: AstNode): x is Number {
	return x instanceof Number;
}

export class IfStatement extends AstNodeBase {
	cond: AstNode;
	thenBlock: AstNode[];
	elseBlock: AstNode[];

	constructor(cond: AstNode, thenBlock: AstNode[], elseBlock: AstNode[], pos: number) {
		super(pos);
		this.cond = cond;
		this.thenBlock = thenBlock;
		this.elseBlock = elseBlock;
		this.pos = pos;
	}
}
export function isIfStatement(x: AstNode): x is IfStatement {
	return x instanceof IfStatement;
}

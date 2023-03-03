import { AstNode, NodeOf } from '../syntax/ast';

export type Visitor = {
	[key in AstNode['kind']]?: VisitorAction<NodeOf<key>>;
};

export type VisitorAction<T> = (node: T) => void;

export function visit(node: AstNode, visitor: Visitor) {
	const handler = visitor[node.kind] as VisitorAction<AstNode>;
	if (handler != null) {
		handler(node);
	}

	switch (node.kind) {
		case 'SourceFile': {
			visitNodes(node.funcs, visitor);
			break;
		}
		case 'FunctionDecl': {
			visitNodes(node.params, visitor);
			visitNodes(node.body, visitor);
			break;
		}
		case 'VariableDecl': {
			if (node.body != null) {
				visit(node.body, visitor);
			}
			break;
		}
		case 'AssignStatement': {
			visit(node.target, visitor);
			visit(node.body, visitor);
			break;
		}
		case 'IfStatement': {
			visit(node.cond, visitor);
			visitNodes(node.thenBlock, visitor);
			visitNodes(node.elseBlock, visitor);
			break;
		}
		case 'LoopStatement': {
			visitNodes(node.block, visitor);
			break;
		}
		case 'ReturnStatement': {
			if (node.expr != null) {
				visit(node.expr, visitor);
			}
			break;
		}
		case 'BreakStatement': {
			break;
		}
		case 'NumberLiteral': {
			break;
		}
		case 'BoolLiteral': {
			break;
		}
		case 'StringLiteral': {
			break;
		}
		case 'BinaryOp': {
			visit(node.left, visitor);
			visit(node.right, visitor);
			break;
		}
		case 'UnaryOp': {
			visit(node.expr, visitor);
			break;
		}
		case 'StringLiteral': {
			break;
		}
		case 'Call': {
			visit(node.callee, visitor);
			visitNodes(node.args, visitor);
			break;
		}
	}
}

function visitNodes(nodes: AstNode[], visitor: Visitor) {
	for (const node of nodes) {
		visit(node, visitor);
	}
}

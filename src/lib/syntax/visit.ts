import { AstNode } from './ast';

export type Visitor = (node: AstNode) => boolean;

export function visitNode(node: AstNode, visitor: Visitor) {
	if (!visitor(node)) {
		return;
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
				visitNode(node.body, visitor);
			}
			break;
		}
		case 'AssignStatement': {
			visitNode(node.target, visitor);
			visitNode(node.body, visitor);
			break;
		}
		case 'IfStatement': {
			visitNode(node.cond, visitor);
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
				visitNode(node.expr, visitor);
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
			visitNode(node.left, visitor);
			visitNode(node.right, visitor);
			break;
		}
		case 'UnaryOp': {
			visitNode(node.expr, visitor);
			break;
		}
		case 'StringLiteral': {
			break;
		}
		case 'Call': {
			visitNode(node.callee, visitor);
			visitNodes(node.args, visitor);
			break;
		}
	}
}

export function visitNodes(nodes: AstNode[], visitor: Visitor) {
	for (const node of nodes) {
		visitNode(node, visitor);
	}
}

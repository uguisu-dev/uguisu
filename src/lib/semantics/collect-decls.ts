import { inspect } from 'util';
import { UguisuError } from '../misc/errors.js';
import { SourceFile, SyntaxNode } from '../syntax/node.js';
import { Symbol } from './symbol.js';

/**
 * collect declarations, and make DeclTable.
*/
export function collectDecls(fileNode: SourceFile): Map<SyntaxNode, Symbol> {
    const declTable = new Map<SyntaxNode, Symbol>();
    visitNodes(fileNode.decls, declTable);
    return declTable;
}

function visitNodes(nodes: SyntaxNode[], declTable: Map<SyntaxNode, Symbol>) {
    for (const node of nodes) {
        visitNode(node, declTable);
    }
}

function visitNode(node: SyntaxNode, declTable: Map<SyntaxNode, Symbol>) {
    console.log(inspect(node, { depth: 10 }));
    switch (node.kind) {
        // FileNode
        case 'FunctionDecl': {
            // TODO: create symbol
            visitNodes(node.params, declTable);
            visitNodes(node.body, declTable);
            if (node.returnTy != null) {
                visitNode(node.returnTy, declTable);
            }
            break;
        }
        case 'StructDecl': {
            // TODO: create symbol
            visitNodes(node.fields, declTable);
            break;
        }
        // StatementNode
        case 'VariableDecl': {
            if (node.ty != null) {
                visitNode(node.ty, declTable);
            }
            if (node.body != null) {
                visitNode(node.body, declTable);
            }
            break;
        }
        case 'AssignStatement': {
            visitNode(node.target, declTable);
            visitNode(node.body, declTable);
            break;
        }
        case 'ExprStatement': {
            visitNode(node.expr, declTable);
            break;
        }
        case 'LoopStatement': {
            visitNodes(node.block, declTable);
            break;
        }
        case 'ReturnStatement': {
            if (node.expr != null) {
                visitNode(node.expr, declTable);
            }
            break;
        }
        case 'BreakStatement': {
            // nop
            break;
        }
        // ExprNode
        case 'NumberLiteral': {
            // nop
            break;
        }
        case 'BoolLiteral': {
            // nop
            break;
        }
        case 'CharLiteral': {
            // nop
            break;
        }
        case 'StringLiteral': {
            // nop
            break;
        }
        case 'BinaryOp': {
            visitNode(node.left, declTable);
            visitNode(node.right, declTable);
            break;
        }
        case 'UnaryOp': {
            visitNode(node.expr, declTable);
            break;
        }
        case 'Identifier': {
            // nop
            break;
        }
        case 'Call': {
            visitNode(node.callee, declTable);
            visitNodes(node.args, declTable);
            break;
        }
        case 'StructExpr': {
            visitNodes(node.fields, declTable);
            break;
        }
        case 'FieldAccess': {
            visitNode(node.target, declTable);
            break;
        }
        case 'ArrayNode': {
            visitNodes(node.items, declTable);
            break;
        }
        case 'IndexAccess': {
            visitNode(node.target, declTable);
            visitNode(node.index, declTable);
            break;
        }
        case 'IfExpr': {
            visitNode(node.cond, declTable);
            visitNodes(node.thenBlock, declTable);
            visitNodes(node.elseBlock, declTable);
            break;
        }
        // others
        case 'FnDeclParam': {
            if (node.ty != null) {
                visitNode(node.ty, declTable);
            }
            break;
        }
        case 'TyLabel': {
            // nop
            break;
        }
        case 'StructDeclField': {
            if (node.ty != null) {
                visitNode(node.ty, declTable);
            }
            break;
        }
        case 'StructExprField': {
            visitNode(node.body, declTable);
            break;
        }
        default: {
            throw new UguisuError('unhandled node');
        }
    }
}

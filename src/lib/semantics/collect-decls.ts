import { UguisuError } from '../misc/errors.js';
import { SourceFile, SyntaxNode } from '../syntax/node.js';
import { createFunctionSymbol, createStructSymbol, createVariableSymbol, Symbol } from './symbol.js';
import { pendingType } from './type.js';

/**
 * collect declarations, and make DeclTable.
*/
export function collectDecls(fileNode: SourceFile): Map<SyntaxNode, Symbol> {
    const declTable = new Map<SyntaxNode, Symbol>();
    const collector = new DeclCollector(declTable);
    collector.visitNode(fileNode);
    return declTable;
}

class DeclCollector {
    declTable: Map<SyntaxNode, Symbol>;
    constructor(declTable: Map<SyntaxNode, Symbol>) {
        this.declTable = declTable;
    }
    dispatchWarn(message: string, errorNode?: SyntaxNode) {
        // TODO
    }
    dispatchError(message: string, errorNode?: SyntaxNode) {
        // TODO
    }
    visitNodes(nodes: SyntaxNode[]) {
        for (const node of nodes) {
            this.visitNode(node);
        }
    }
    visitNode(node: SyntaxNode) {
        switch (node.kind) {
            case 'SourceFile': {
                this.visitNodes(node.decls);
                return;
            }
            case 'FunctionDecl': {
                // export specifier
                if (node.exported) {
                    this.dispatchWarn('exported function is not supported yet.', node);
                }
                // make param list
                const params = node.params.map(x => ({ name: x.name }));
                // set symbol
                const symbol = createFunctionSymbol(params, pendingType, []);
                this.declTable.set(node, symbol);

                this.visitNodes(node.body);
                return;
            }
            case 'StructDecl': {
                // export specifier
                if (node.exported) {
                    this.dispatchWarn('exported function is not supported yet.', node);
                }
                // make fields
                const fields = new Map<string, Symbol>();
                for (const field of node.fields) {
                    const fieldSymbol = createVariableSymbol(pendingType, true);
                    fields.set(field.name, fieldSymbol);
                }
                // set symbol
                const symbol: Symbol = createStructSymbol(node.name, fields);
                this.declTable.set(node, symbol);
                return;
            }
            case 'VariableDecl': {
                // set symbol
                const symbol = createVariableSymbol(pendingType, false);
                this.declTable.set(node, symbol);

                if (node.body != null) {
                    this.visitNode(node.body);
                }
                return;
            }
            case 'AssignStatement': {
                this.visitNode(node.target);
                this.visitNode(node.body);
                return;
            }
            case 'ExprStatement': {
                this.visitNode(node.expr);
                return;
            }
            case 'LoopStatement': {
                this.visitNodes(node.block);
                return;
            }
            case 'ReturnStatement': {
                if (node.expr != null) {
                    this.visitNode(node.expr);
                }
                return;
            }
            case 'BinaryOp': {
                this.visitNode(node.left);
                this.visitNode(node.right);
                return;
            }
            case 'UnaryOp': {
                this.visitNode(node.expr);
                return;
            }
            case 'Call': {
                this.visitNode(node.callee);
                this.visitNodes(node.args);
                return;
            }
            case 'StructExpr': {
                this.visitNodes(node.fields);
                return;
            }
            case 'StructExprField': {
                this.visitNode(node.body);
                return;
            }
            case 'FieldAccess': {
                this.visitNode(node.target);
                return;
            }
            case 'ArrayNode': {
                this.visitNodes(node.items);
                return;
            }
            case 'IndexAccess': {
                this.visitNode(node.target);
                this.visitNode(node.index);
                return;
            }
            case 'IfExpr': {
                this.visitNode(node.cond);
                this.visitNodes(node.thenBlock);
                this.visitNodes(node.elseBlock);
                return;
            }
            case 'FnDeclParam':
            case 'StructDeclField':
            case 'BreakStatement':
            case 'NumberLiteral':
            case 'BoolLiteral':
            case 'CharLiteral':
            case 'StringLiteral':
            case 'Identifier':
            case 'TyLabel': {
                // nop
                return;
            }
        }
        throw new UguisuError('unexpected node');
    }
}

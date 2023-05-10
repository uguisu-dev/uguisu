import { SourceFile, SyntaxNode } from '../syntax/node.js';
import { Symbol } from './symbol.js';

class NameEnv {
    upperEnv?: NameEnv;
    table: Map<string, Symbol>;
    constructor(upperEnv?: NameEnv) {
        this.upperEnv = upperEnv;
        this.table = new Map();
    }
    declare(name: string, symbol: Symbol) {
        this.table.set(name, symbol);
    }
    lookup(name: string): Symbol | undefined {
        const symbol = this.table.get(name);
        if (symbol != null) {
            return symbol;
        }
        return this.upperEnv?.lookup(name);
    }
    createLowerEnv(): NameEnv {
        return new NameEnv(this);
    }
}

/**
 * resolve name nodes, and make NameTable.
*/
export function resolveNames(fileNode: SourceFile, declTable: Map<SyntaxNode, Symbol>): Map<SyntaxNode, Symbol> {
    const resolver = new NameResolver(declTable);
    const rootEnv = new NameEnv();
    resolver.visitNode(fileNode, rootEnv);
    return resolver.nameTable;
}

class NameResolver {
    declTable: Map<SyntaxNode, Symbol>;
    nameTable: Map<SyntaxNode, Symbol>;
    constructor(declTable: Map<SyntaxNode, Symbol>) {
        this.declTable = declTable;
        this.nameTable = new Map<SyntaxNode, Symbol>();
    }
    dispatchWarn(message: string, errorNode?: SyntaxNode) {
        // TODO
    }
    dispatchError(message: string, errorNode?: SyntaxNode) {
        // TODO
    }
    visitNodes(nodes: SyntaxNode[], env: NameEnv) {
        for (const node of nodes) {
            this.visitNode(node, env);
        }
    }
    visitNode(node: SyntaxNode, env: NameEnv) {
        //console.log(inspect(node, { depth: 10 }));
        switch (node.kind) {
            case 'SourceFile': {
                this.visitNodes(node.decls, env);
                return;
            }
            case 'FunctionDecl': {
                node.name;
                node.params;

                this.visitNodes(node.body, env);
                return;
            }
            case 'StructDecl': {

                return;
            }
            case 'VariableDecl': {
                if (node.body != null) {
                    this.visitNode(node.body, env);
                }
                return;
            }
            case 'AssignStatement': {
                this.visitNode(node.target, env);
                this.visitNode(node.body, env);
                return;
            }
            case 'ExprStatement': {
                this.visitNode(node.expr, env);
                return;
            }
            case 'LoopStatement': {
                this.visitNodes(node.block, env);
                return;
            }
            case 'ReturnStatement': {
                if (node.expr != null) {
                    this.visitNode(node.expr, env);
                }
                return;
            }
            case 'BinaryOp': {
                this.visitNode(node.left, env);
                this.visitNode(node.right, env);
                return;
            }
            case 'UnaryOp': {
                this.visitNode(node.expr, env);
                return;
            }
            case 'Call': {
                this.visitNode(node.callee, env);
                this.visitNodes(node.args, env);
                return;
            }
            case 'StructExpr': {
                this.visitNodes(node.fields, env);
                return;
            }
            case 'StructExprField': {
                this.visitNode(node.body, env);
                return;
            }
            case 'FieldAccess': {
                this.visitNode(node.target, env);
                return;
            }
            case 'ArrayNode': {
                this.visitNodes(node.items, env);
                return;
            }
            case 'IndexAccess': {
                this.visitNode(node.target, env);
                this.visitNode(node.index, env);
                return;
            }
            case 'IfExpr': {
                this.visitNode(node.cond, env);
                this.visitNodes(node.thenBlock, env);
                this.visitNodes(node.elseBlock, env);
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
    }
}

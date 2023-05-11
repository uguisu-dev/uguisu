import { inspect } from 'util';
import { UguisuError } from '../misc/errors.js';
import { SourceFile, SyntaxNode } from '../syntax/node.js';
import { Symbol } from './symbol.js';

class NameEnv {
    private parentEnv?: WeakRef<NameEnv>; // use WeakRef for memory leak
    private table: Map<string, Symbol>;
    children: NameEnv[];
    constructor(parentEnv?: WeakRef<NameEnv>) {
        this.parentEnv = parentEnv;
        this.table = new Map();
        this.children = [];
    }
    declare(name: string, symbol: Symbol) {
        this.table.set(name, symbol);
    }
    lookup(name: string): Symbol | undefined {
        // current env
        const symbol = this.table.get(name);
        if (symbol != null) {
            return symbol;
        }
        // lookup parent env
        return this.getParentEnv()?.lookup(name);
    }
    getParentEnv(): NameEnv | undefined {
        this.parentEnv;
        if (!this.parentEnv) {
            return undefined;
        }
        return this.parentEnv.deref();
    }
    addChild(): NameEnv {
        const child = new NameEnv(new WeakRef(this));
        this.children.push(child);
        return child;
    }
    removeChildren() {
        this.children.splice(0, this.children.length);
    }
}

/**
 * resolve name nodes, and make NameTable.
*/
export function resolveNames(fileNode: SourceFile, declTable: Map<SyntaxNode, Symbol>): Map<SyntaxNode, Symbol> {
    const resolver = new NameResolver(declTable);
    const rootEnv = new NameEnv();
    resolver.visitNode(fileNode, rootEnv);
    console.log(inspect(rootEnv, { depth: 10 }));
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
    visitBlock(nodes: SyntaxNode[], env: NameEnv) {
        const blockEnv = env.addChild();
        this.visitNodes(nodes, blockEnv);
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
                const symbol = this.declTable.get(node);
                if (symbol == null) {
                    throw new UguisuError('function not declared');
                }
                env.declare(node.name, symbol);
                this.visitBlock(node.body, env);
                return;
            }
            case 'StructDecl': {
                const symbol = this.declTable.get(node);
                if (symbol == null) {
                    throw new UguisuError('struct not declared');
                }
                env.declare(node.name, symbol);
                return;
            }
            case 'VariableDecl': {
                const symbol = this.declTable.get(node);
                if (symbol == null) {
                    throw new UguisuError('variable not declared');
                }
                env.declare(node.name, symbol);
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
                this.visitBlock(node.block, env);
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
                this.visitBlock(node.thenBlock, env);
                this.visitBlock(node.elseBlock, env);
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

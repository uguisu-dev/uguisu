import { UguisuError } from '../misc/errors.js';
import { ProjectInfo } from '../project-file.js';
import { AstNode } from '../syntax/tools.js';
import { Symbol } from './symbols.js';

export class AnalyzeContext {
    symbolTable: Map<AstNode, Symbol>;
    projectInfo: ProjectInfo;
    warn: string[];
    error: string[];
    // flags
    isUsedAnyType: boolean;

    constructor(symbolTable: Map<AstNode, Symbol>, projectInfo: ProjectInfo) {
        this.symbolTable = symbolTable;
        this.projectInfo = projectInfo;
        this.warn = [];
        this.error = [];
        this.isUsedAnyType = false;
    }

    dispatchWarn(message: string, node?: AstNode) {
        if (node != null) {
            this.warn.push(`${message} (${node.pos[0]}:${node.pos[1]})`);
        } else {
            this.warn.push(message);
        }
    }

    dispatchError(message: string, errorNode?: AstNode) {
        if (errorNode != null) {
            this.error.push(`${message} (${errorNode.pos[0]}:${errorNode.pos[1]})`);
        } else {
            this.error.push(message);
        }
    }
}

export class SymbolEnv {
    private layers: Map<string, Symbol>[];

    constructor(baseEnv?: SymbolEnv) {
        if (baseEnv != null) {
            this.layers = [...baseEnv.layers];
        } else {
            this.layers = [new Map()];
        }
    }

    set(name: string, symbol: Symbol) {
        this.layers[0].set(name, symbol);
    }

    get(name: string): Symbol | undefined {
        for (const layer of this.layers) {
            const symbol = layer.get(name);
            if (symbol != null) {
                return symbol;
            }
        }
        return undefined;
    }

    enter() {
        this.layers.unshift(new Map());
    }

    leave() {
        if (this.layers.length <= 1) {
            throw new UguisuError('Left the root layer.');
        }
        this.layers.shift();
    }
}

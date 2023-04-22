import { SourceFile, SyntaxNode } from '../syntax/node.js';
import { Symbol } from './symbol.js';

/**
 * resolve name nodes, and make NameTable.
*/
export function resolveName(fileNode: SourceFile, declTable: Map<SyntaxNode, Symbol>): Map<SyntaxNode, Symbol> {
    const nameTable = new Map<SyntaxNode, Symbol>();

    return nameTable;
}

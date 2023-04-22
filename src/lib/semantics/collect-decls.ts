import { SourceFile, SyntaxNode } from '../syntax/node.js';
import { Symbol } from './symbol.js';

/**
 * collect declarations, and make DeclTable.
*/
export function collectDecls(fileNode: SourceFile): Map<SyntaxNode, Symbol> {
    const declTable = new Map<SyntaxNode, Symbol>();

    return declTable;
}

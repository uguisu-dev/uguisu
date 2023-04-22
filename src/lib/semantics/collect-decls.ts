import { SourceFile, SyntaxNode } from '../syntax/node.js';
import { Symbol } from './symbol.js';

/**
 * collect declarations, and make DeclTable.
*/
export function collectDecls(fileNode: SourceFile): Map<SyntaxNode, Symbol> {
    const declTable = new Map<SyntaxNode, Symbol>();

    for (const node of fileNode.decls) {
        visitNode(node, declTable);
    }

    return declTable;
}

function visitNode(node: SyntaxNode, declTable: Map<SyntaxNode, Symbol>) {
    switch (node.kind) {
    }
}

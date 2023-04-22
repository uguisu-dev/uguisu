import { SourceFile, SyntaxNode } from '../syntax/node.js';
import { Symbol } from './symbol.js';

/**
 * resolve name nodes, and make NameTable.
*/
export function resolveNames(fileNode: SourceFile, declTable: Map<SyntaxNode, Symbol>): Map<SyntaxNode, Symbol> {
    const nameTable = new Map<SyntaxNode, Symbol>();

    for (const node of fileNode.decls) {
        visitNode(node, declTable, nameTable);
    }

    return nameTable;
}

function visitNode(node: SyntaxNode, declTable: Map<SyntaxNode, Symbol>, nameTable: Map<SyntaxNode, Symbol>) {
    //console.log(inspect(node, { depth: 10 }));
    switch (node.kind) {
    }
}

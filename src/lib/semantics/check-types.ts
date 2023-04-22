import { SourceFile, SyntaxNode } from '../syntax/node.js';
import { Symbol } from './symbol.js';

/**
 * check types
 */
export function checkTypes(fileNode: SourceFile, declTable: Map<SyntaxNode, Symbol>, nameTable: Map<SyntaxNode, Symbol>) {
    for (const node of fileNode.decls) {
        visitNode(node, declTable, nameTable);
    }
}

function visitNode(node: SyntaxNode, declTable: Map<SyntaxNode, Symbol>, nameTable: Map<SyntaxNode, Symbol>) {
    //console.log(inspect(node, { depth: 10 }));
    switch (node.kind) {
    }
}

// TODO

import { AstNode, SourceFile } from '../syntax/ast';
import { visitNode } from '../syntax/visit';

export type Path = {
	handler: (node: AstNode) => boolean,
};

export function apply(source: SourceFile, pathes: Path[]) {
	for (const path of pathes) {
		visitNode(source, (node) => path.handler(node));
	}
}

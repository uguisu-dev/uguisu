import { SourceFile } from '../syntax/ast';
import { visit, Visitor } from './visit';

export function checkTypes(source: SourceFile) {
	const visitor: Visitor = { };
	visit(source, visitor);
}

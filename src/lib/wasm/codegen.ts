import { AstNode, SourceFile } from '../ast.js';
import Wasm from 'binaryen';

export function codegen(node: SourceFile) {
	const mod = translate(node);
	return mod.emitText();
}

function translate(node: SourceFile): Wasm.Module {
	const mod = new Wasm.Module();
	mod.addDebugInfoFileName(node.filename);

	for (const func of node.funcs) {
		translateNode(func, mod);
	}

	mod.optimize();

	if (!mod.validate()) {
		throw new Error('failed to generate the wasm code.');
	}

	return mod;
}

function translateNode(node: AstNode, mod: Wasm.Module) {
	switch (node.kind) {
		case 'FunctionDecl': {
			const block = mod.block(null, []);
			mod.addFunction(node.name, Wasm.createType([]), Wasm.none, [], block);
			mod.addFunctionExport(node.name, node.name);
			break;
		}
	}
}

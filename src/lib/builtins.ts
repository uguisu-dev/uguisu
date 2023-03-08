import { StdoutCallback } from './index.js';
import {
	assertNumber,
	assertString,
	RunningEnv,
	newNativeFunction,
	newNoneValue,
	newNumber,
	newString,
} from './run.js';
import { AnalysisEnv, NativeFnSymbol, Type } from './analyze.js';

function nativeFnSymbol(params: { name: string, ty: Type }[], returnTy: Type): NativeFnSymbol {
	return { kind: 'NativeFnSymbol', params, returnTy };
}

function setDecl(name: string, paramsTy: Type[], returnTy: Type, env: AnalysisEnv) {
	const params = paramsTy.map(ty => ({ name: 'x', ty: ty }));
	env.set(name, nativeFnSymbol(params, returnTy));
}

export function setDeclarations(env: AnalysisEnv) {
	setDecl('printStr', ['string'], 'void', env);
	setDecl('printNum', ['number'], 'void', env);
	setDecl('printLF', [], 'void', env);
	setDecl('assertEq', ['number', 'number'], 'void', env);
	setDecl('getUnixtime', [], 'number', env);
	setDecl('concatStr', ['string', 'string'], 'string', env);
	setDecl('toString', ['number'], 'string', env);
}

export function setRuntime(env: RunningEnv, stdout: StdoutCallback) {

	const printStr = newNativeFunction((args) => {
		if (args.length != 1) {
			throw new Error('invalid arguments count');
		}
		assertString(args[0]);
		stdout(args[0].value);
		return newNoneValue();
	});
	env.define('printStr', printStr);

	const printNum = newNativeFunction((args) => {
		if (args.length != 1) {
			throw new Error('invalid arguments count');
		}
		assertNumber(args[0]);
		stdout(args[0].value.toString());
		return newNoneValue();
	});
	env.define('printNum', printNum);

	const printLF = newNativeFunction((args) => {
		if (args.length != 0) {
			throw new Error('invalid arguments count');
		}
		stdout('\n');
		return newNoneValue();
	});
	env.define('printLF', printLF);

	const assertEq = newNativeFunction((args) => {
		if (args.length != 2) {
			throw new Error('invalid arguments count');
		}
		assertNumber(args[0]);
		assertNumber(args[1]);
		const actual = args[0].value;
		const expected = args[1].value;
		if (actual != expected) {
			throw new Error(`assertion error. expected \`${expected}\`, actual \`${actual}\`.`);
		}
		return newNoneValue();
	});
	env.define('assertEq', assertEq);

	const getUnixtime = newNativeFunction((args) => {
		if (args.length != 0) {
			throw new Error('invalid arguments count');
		}
		const unixTime = Math.floor(Date.now() / 1000);
		return newNumber(unixTime);
	});
	env.define('getUnixtime', getUnixtime);

	const concatStr = newNativeFunction((args) => {
		if (args.length != 2) {
			throw new Error('invalid arguments count');
		}
		assertString(args[0]);
		assertString(args[1]);
		return newString(args[0].value + args[1].value);
	});
	env.define('concatStr', concatStr);

	const toString = newNativeFunction((args) => {
		if (args.length != 1) {
			throw new Error('invalid arguments count');
		}
		assertNumber(args[0]);
		return newString(args[0].value.toString());
	});
	env.define('toString', toString);

}

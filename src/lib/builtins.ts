import { StdoutCallback } from '.';
import {
	assertNumber,
	assertString,
	RunningEnv,
	newNativeFunction,
	newNoneValue,
	newNumber,
	newString,
} from './run';

import { AnalysisEnv, NativeFnSymbol, Type } from './type-check';

function nativeFnSymbol(paramsTy: Type[], returnTy: Type): NativeFnSymbol {
	return { kind: 'NativeFnSymbol', paramsTy, returnTy };
}

export function setDeclarations(env: AnalysisEnv) {
	env.set('printStr', nativeFnSymbol(['string'], 'void'));
	env.set('printNum', nativeFnSymbol(['number'], 'void'));
	env.set('printLF', nativeFnSymbol([], 'void'));
	env.set('assertEq', nativeFnSymbol(['number', 'number'], 'void'));
	env.set('getUnixtime', nativeFnSymbol([], 'number'));
	env.set('concatStr', nativeFnSymbol(['string', 'string'], 'string'));
	env.set('toString', nativeFnSymbol(['number'], 'string'));
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

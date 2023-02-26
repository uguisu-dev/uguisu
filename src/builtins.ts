import {
	asNumberValue,
	asStringValue,
	Env,
	newNativeFunctionValue,
	newNoneValue,
	newNumberValue,
	newStringValue,
} from './syntax/run';

export function setBuiltinRuntimes(env: Env) {

	const printStr = newNativeFunctionValue((args) => {
		if (args.length != 1) {
			throw new Error('invalid arguments count');
		}
		asStringValue(args[0]);
		process.stdout.write(args[0].value);
		return newNoneValue();
	});
	env.set('printStr', printStr);

	const printNum = newNativeFunctionValue((args) => {
		if (args.length != 1) {
			throw new Error('invalid arguments count');
		}
		asNumberValue(args[0]);
		process.stdout.write(args[0].value.toString());
		return newNoneValue();
	});
	env.set('printNum', printNum);

	const printLF = newNativeFunctionValue((args) => {
		if (args.length != 0) {
			throw new Error('invalid arguments count');
		}
		process.stdout.write('\n');
		return newNoneValue();
	});
	env.set('printLF', printLF);

	const assertEq = newNativeFunctionValue((args) => {
		if (args.length != 2) {
			throw new Error('invalid arguments count');
		}
		asNumberValue(args[0]);
		asNumberValue(args[1]);
		const actual = args[0].value;
		const expected = args[1].value;
		if (actual != expected) {
			throw new Error(`assertion error. expected \`${expected}\`, actual \`${actual}\`.`);
		}
		return newNoneValue();
	});
	env.set('assertEq', assertEq);

	const getUnixtime = newNativeFunctionValue((args) => {
		if (args.length != 0) {
			throw new Error('invalid arguments count');
		}
		const unixTime = Math.floor(Date.now() / 1000);
		return newNumberValue(unixTime);
	});
	env.set('getUnixtime', getUnixtime);

	const concatStr = newNativeFunctionValue((args) => {
		if (args.length != 2) {
			throw new Error('invalid arguments count');
		}
		asStringValue(args[0]);
		asStringValue(args[1]);
		return newStringValue(args[0].value + args[1].value);
	});
	env.set('concatStr', concatStr);

	const toString = newNativeFunctionValue((args) => {
		if (args.length != 1) {
			throw new Error('invalid arguments count');
		}
		asNumberValue(args[0]);
		return newStringValue(args[0].value.toString());
	});
	env.set('toString', toString);

}

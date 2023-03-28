import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import {
    assertValue,
    newNativeFunction,
    newNone,
    newNumber,
    newString,
    RunningEnv
} from './tools.js';

export function setRuntime(env: RunningEnv, options: UguisuOptions) {

    const printStr = newNativeFunction((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'StringValue');
        if (options.stdout) {
            options.stdout(args[0].getValue());
        }
        return newNone();
    });
    env.define('printStr', printStr);

    const printNum = newNativeFunction((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'NumberValue');
        if (options.stdout) {
            options.stdout(args[0].getValue().toString());
        }
        return newNone();
    });
    env.define('printNum', printNum);

    const assertEqNum = newNativeFunction((args) => {
        if (args.length != 2) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'NumberValue');
        assertValue(args[1], 'NumberValue');
        const actual = args[0].getValue();
        const expected = args[1].getValue();
        if (actual != expected) {
            throw new UguisuError(`assertion error. expected \`${expected}\`, actual \`${actual}\`.`);
        }
        return newNone();
    });
    env.define('assertEqNum', assertEqNum);

    const assertEqStr = newNativeFunction((args) => {
        if (args.length != 2) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'StringValue');
        assertValue(args[1], 'StringValue');
        const actual = args[0].getValue();
        const expected = args[1].getValue();
        if (actual != expected) {
            throw new UguisuError(`assertion error. expected \`${expected}\`, actual \`${actual}\`.`);
        }
        return newNone();
    });
    env.define('assertEqStr', assertEqStr);

    const getUnixtime = newNativeFunction((args) => {
        if (args.length != 0) {
            throw new UguisuError('invalid arguments count');
        }
        const unixTime = Math.floor(Date.now() / 1000);
        return newNumber(unixTime);
    });
    env.define('getUnixtime', getUnixtime);

    const concatStr = newNativeFunction((args) => {
        if (args.length != 2) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'StringValue');
        assertValue(args[1], 'StringValue');
        return newString(args[0].getValue() + args[1].getValue());
    });
    env.define('concatStr', concatStr);

    const toString = newNativeFunction((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'NumberValue');
        return newString(args[0].getValue().toString());
    });
    env.define('toString', toString);

}

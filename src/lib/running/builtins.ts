import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import {
    assertNumber,
    assertString,
    newNativeFunction,
    newNoneValue,
    newNumber,
    newString,
    RunningEnv
} from './tools.js';

export function setRuntime(env: RunningEnv, options: UguisuOptions) {

    const printStr = newNativeFunction((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertString(args[0]);
        if (options.stdout) {
            options.stdout(args[0].getValue());
        }
        return newNoneValue();
    });
    env.define('printStr', printStr);

    const printNum = newNativeFunction((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertNumber(args[0]);
        if (options.stdout) {
            options.stdout(args[0].getValue().toString());
        }
        return newNoneValue();
    });
    env.define('printNum', printNum);

    const assertEqNum = newNativeFunction((args) => {
        if (args.length != 2) {
            throw new UguisuError('invalid arguments count');
        }
        assertNumber(args[0]);
        assertNumber(args[1]);
        const actual = args[0].getValue();
        const expected = args[1].getValue();
        if (actual != expected) {
            throw new UguisuError(`assertion error. expected \`${expected}\`, actual \`${actual}\`.`);
        }
        return newNoneValue();
    });
    env.define('assertEqNum', assertEqNum);

    const assertEqStr = newNativeFunction((args) => {
        if (args.length != 2) {
            throw new UguisuError('invalid arguments count');
        }
        assertString(args[0]);
        assertString(args[1]);
        const actual = args[0].getValue();
        const expected = args[1].getValue();
        if (actual != expected) {
            throw new UguisuError(`assertion error. expected \`${expected}\`, actual \`${actual}\`.`);
        }
        return newNoneValue();
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
        assertString(args[0]);
        assertString(args[1]);
        return newString(args[0].getValue() + args[1].getValue());
    });
    env.define('concatStr', concatStr);

    const toString = newNativeFunction((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertNumber(args[0]);
        return newString(args[0].getValue().toString());
    });
    env.define('toString', toString);

}

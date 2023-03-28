import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import {
    assertValue,
    FunctionValue,
    NoneValue,
    NumberValue,
    RunningEnv,
    StringValue
} from './tools.js';

export function setRuntime(env: RunningEnv, options: UguisuOptions) {

    const printStr = FunctionValue.createNative((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'StringValue');
        if (options.stdout) {
            options.stdout(args[0].getValue());
        }
        return new NoneValue();
    });
    env.define('printStr', printStr);

    const printNum = FunctionValue.createNative((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'NumberValue');
        if (options.stdout) {
            options.stdout(args[0].getValue().toString());
        }
        return new NoneValue();
    });
    env.define('printNum', printNum);

    const assertEqNum = FunctionValue.createNative((args) => {
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
        return new NoneValue();
    });
    env.define('assertEqNum', assertEqNum);

    const assertEqStr = FunctionValue.createNative((args) => {
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
        return new NoneValue();
    });
    env.define('assertEqStr', assertEqStr);

    const getUnixtime = FunctionValue.createNative((args) => {
        if (args.length != 0) {
            throw new UguisuError('invalid arguments count');
        }
        const unixTime = Math.floor(Date.now() / 1000);
        return new NumberValue(unixTime);
    });
    env.define('getUnixtime', getUnixtime);

    const concatStr = FunctionValue.createNative((args) => {
        if (args.length != 2) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'StringValue');
        assertValue(args[1], 'StringValue');
        return new StringValue(args[0].getValue() + args[1].getValue());
    });
    env.define('concatStr', concatStr);

    const toString = FunctionValue.createNative((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'NumberValue');
        return new StringValue(args[0].getValue().toString());
    });
    env.define('toString', toString);

}

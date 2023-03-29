import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import {
    assertValue,
    FunctionValue,
    NoneValue,
    NumberValue,
    RunningEnv,
    StringValue,
    Symbol
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
    env.declare('printStr', printStr);

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
    env.declare('printNum', printNum);

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
    env.declare('assertEqNum', assertEqNum);

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
    env.declare('assertEqStr', assertEqStr);

    const getUnixtime = FunctionValue.createNative((args) => {
        if (args.length != 0) {
            throw new UguisuError('invalid arguments count');
        }
        const unixTime = Math.floor(Date.now() / 1000);
        return new NumberValue(unixTime);
    });
    env.declare('getUnixtime', getUnixtime);

    const concatStr = FunctionValue.createNative((args) => {
        if (args.length != 2) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'StringValue');
        assertValue(args[1], 'StringValue');
        return new StringValue(args[0].getValue() + args[1].getValue());
    });
    env.declare('concatStr', concatStr);

    const toString = FunctionValue.createNative((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'NumberValue');
        return new StringValue(args[0].getValue().toString());
    });
    env.declare('toString', toString);

    const insert = FunctionValue.createNative((args) => {
        if (args.length != 3) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'ArrayValue');
        assertValue(args[1], 'NumberValue');
        const target = args[0];
        const index = args[1].getValue();
        const symbol = new Symbol(args[2]);
        target.insert(index, symbol);
        return new NoneValue();
    });
    env.declare('insert', insert);

    const add = FunctionValue.createNative((args) => {
        if (args.length != 2) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'ArrayValue');
        const target = args[0];
        const symbol = new Symbol(args[1]);
        target.insert(target.count(), symbol);
        return new NoneValue();
    });
    env.declare('add', add);

    const removeAt = FunctionValue.createNative((args) => {
        if (args.length != 2) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'ArrayValue');
        assertValue(args[1], 'NumberValue');
        const target = args[0];
        const index = args[1].getValue();
        target.removeAt(index);
        return new NoneValue();
    });
    env.declare('removeAt', removeAt);

    const count = FunctionValue.createNative((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'ArrayValue');
        const target = args[0];
        return new NumberValue(target.count());
    });
    env.declare('count', count);

}

import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import {
    assertValue,
    FunctionValue,
    NoneValue,
    NumberValue,
    RunningEnv,
    StringValue,
    StructValue,
    Symbol,
    Value
} from './tools.js';

function group(name: string, env: RunningEnv, handle: (setItem: (name: string, value: Value) => void) => void) {
    const fields = new Map<string, Symbol>();
    function setItem(name: string, value: Value) {
        fields.set(name, new Symbol(value));
    }
    handle(setItem);
    env.declare(name, new StructValue(fields));
}

export function setRuntime(env: RunningEnv, options: UguisuOptions) {
    group('console', env, (setItem) => {
        const writeLine = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'StringValue');
            if (options.stdout) {
                options.stdout(args[0].getValue());
            }
            return new NoneValue();
        });
        setItem('writeLine', writeLine);

        const readLine = FunctionValue.createNative((args) => {
            if (args.length != 0) {
                throw new UguisuError('invalid arguments count');
            }
            if (!options.stdin) {
                throw new UguisuError('stdin not found');
            }
            return new StringValue(options.stdin());
        });
        setItem('readLine', readLine);
    });

    const writeLine = FunctionValue.createNative((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'StringValue');
        if (options.stdout) {
            options.stdout(args[0].getValue());
        }
        return new NoneValue();
    });
    env.declare('writeLine', writeLine);

    const readLine = FunctionValue.createNative((args) => {
        if (args.length != 0) {
            throw new UguisuError('invalid arguments count');
        }
        if (!options.stdin) {
            throw new UguisuError('stdin not found');
        }
        return new StringValue(options.stdin());
    });
    env.declare('readLine', readLine);

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

    const parseNum = FunctionValue.createNative((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'StringValue');
        const parsedValue = Number(args[0].getValue());
        return new NumberValue(parsedValue);
    });
    env.declare('parseNum', parseNum);

    const numToStr = FunctionValue.createNative((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'NumberValue');
        return new StringValue(args[0].getValue().toString());
    });
    env.declare('numToStr', numToStr);

    const insertItem = FunctionValue.createNative((args) => {
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
    env.declare('insertItem', insertItem);

    const addItem = FunctionValue.createNative((args) => {
        if (args.length != 2) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'ArrayValue');
        const target = args[0];
        const symbol = new Symbol(args[1]);
        target.insert(target.count(), symbol);
        return new NoneValue();
    });
    env.declare('addItem', addItem);

    const removeItemAt = FunctionValue.createNative((args) => {
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
    env.declare('removeItemAt', removeItemAt);

    const countItems = FunctionValue.createNative((args) => {
        if (args.length != 1) {
            throw new UguisuError('invalid arguments count');
        }
        assertValue(args[0], 'ArrayValue');
        const target = args[0];
        return new NumberValue(target.count());
    });
    env.declare('countItems', countItems);

}

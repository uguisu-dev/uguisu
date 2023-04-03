import charRegex from 'char-regex';
import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import {
    ArrayValue,
    assertValue,
    CharValue,
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
    group('number', env, setItem => {
        const parse = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'StringValue');
            const parsedValue = Number(args[0].getValue());
            return new NumberValue(parsedValue);
        });
        setItem('parse', parse);

        const toString = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'NumberValue');
            return new StringValue(args[0].getValue().toString());
        });
        setItem('toString', toString);

        const assertEq = FunctionValue.createNative((args) => {
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
        setItem('assertEq', assertEq);
    });

    group('char', env, setItem => {
        const fromNumber = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'NumberValue');
            const charCode = args[0].getValue();
            const charValue = String.fromCharCode(charCode);
            return new CharValue(charValue);
        });
        setItem('fromNumber', fromNumber);

        const toNumber = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'CharValue');
            const charValue = args[0].getValue();
            const charCode = charValue.charCodeAt(0);
            return new NumberValue(charCode);
        });
        setItem('toNumber', toNumber);

        const toString = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'CharValue');
            return new StringValue(args[0].getValue());
        });
        setItem('toString', toString);
    });

    group('string', env, setItem => {
        const concat = FunctionValue.createNative((args) => {
            if (args.length != 2) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'StringValue');
            assertValue(args[1], 'StringValue');
            return new StringValue(args[0].getValue() + args[1].getValue());
        });
        setItem('concat', concat);

        const fromArray = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'ArrayValue');
            const arr: string[] = [];
            for (let i = 0 ; i < args[0].count(); i++) {
                const s: Symbol = args[0].at(i)!;
                if (s.value == null) {
                    throw new UguisuError('variable is not defined');
                }
                assertValue(s.value, 'StringValue');
                arr.push(s.value.getValue());
            }
            return new StringValue(arr.join(''));
        });
        setItem('fromArray', fromArray);

        const toArray = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'StringValue');
            const src = args[0].getValue();
            const arr = src.match(charRegex());
            if (arr == null) {
                return new ArrayValue([]);
            }
            return new ArrayValue(arr.map(x => new Symbol(new StringValue(x))));
        });
        setItem('toArray', toArray);

        const assertEq = FunctionValue.createNative((args) => {
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
        setItem('assertEq', assertEq);
    });

    group('array', env, setItem => {
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
        setItem('insert', insert);

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
        setItem('add', add);

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
        setItem('removeAt', removeAt);

        const count = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'ArrayValue');
            const target = args[0];
            return new NumberValue(target.count());
        });
        setItem('count', count);
    });

    group('console', env, setItem => {
        const write = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'StringValue');
            if (options.stdout) {
                options.stdout(args[0].getValue());
            }
            return new NoneValue();
        });
        setItem('write', write);

        const writeNum = FunctionValue.createNative((args) => {
            if (args.length != 1) {
                throw new UguisuError('invalid arguments count');
            }
            assertValue(args[0], 'NumberValue');
            if (options.stdout) {
                options.stdout(args[0].getValue().toString());
            }
            return new NoneValue();
        });
        setItem('writeNum', writeNum);

        const read = FunctionValue.createNative((args) => {
            if (args.length != 0) {
                throw new UguisuError('invalid arguments count');
            }
            if (!options.stdin) {
                throw new UguisuError('stdin not found');
            }
            return new StringValue(options.stdin());
        });
        setItem('read', read);
    });

    const getUnixtime = FunctionValue.createNative((args) => {
        if (args.length != 0) {
            throw new UguisuError('invalid arguments count');
        }
        const unixTime = Math.floor(Date.now() / 1000);
        return new NumberValue(unixTime);
    });
    env.declare('getUnixtime', getUnixtime);
}

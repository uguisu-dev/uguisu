import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import { Trace } from '../misc/trace.js';
import { ProjectInfo } from '../project-file.js';
import { Value } from './value.js';

export class RunContext {
  env: RunningEnv;
  options: UguisuOptions;
  projectInfo: ProjectInfo;

  constructor(env: RunningEnv, options: UguisuOptions, projectInfo: ProjectInfo) {
    this.env = env;
    this.options = options;
    this.projectInfo = projectInfo;
  }
}

export class RunningEnv {
  layers: Map<string, Symbol>[];
  trace?: Trace;

  constructor(baseEnv?: RunningEnv, trace?: Trace) {
    this.trace = trace;
    if (baseEnv != null) {
      this.layers = [...baseEnv.layers];
    } else {
      this.layers = [new Map()];
    }
  }

  declare(name: string, initialValue?: Value) {
    this.trace?.log(`declare symbol: ${name} ${initialValue}`);
    this.layers[0].set(name, new Symbol(initialValue));
  }

  lookup(name: string): Symbol | undefined {
    this.trace?.log(`get symbol: ${name}`);
    for (const layer of this.layers) {
      const symbol = layer.get(name);
      if (symbol != null) {
        return symbol;
      }
    }
    return undefined;
  }

  enter() {
    this.trace?.log(`enter scope`);
    this.layers.unshift(new Map());
  }

  leave() {
    this.trace?.log(`leave scope`);
    if (this.layers.length <= 1) {
      throw new UguisuError('Left the root layer.');
    }
    this.layers.shift();
  }
}

export class Symbol {
  value?: Value;
  constructor(value?: Value) {
    this.value = value;
  }
}

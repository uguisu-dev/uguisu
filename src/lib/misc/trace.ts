let _default: Trace | null;

export class Trace {
    parent?: Trace;
    depth: number;
    enabled: boolean;

    constructor(enabled: boolean, parent?: Trace) {
        this.parent = parent;
        this.depth = 0;
        this.enabled = enabled;
    }

    log(message: any, ...params: any[]) {
        if (this.enabled) {
            if (this.parent) {
                this.parent.log(message, ...params);
            } else {
                const indent = '  '.repeat(this.depth);
                console.log(indent + message, ...params);
            }
        }
    }

    enter(message: any, ...params: any[]) {
        if (this.enabled) {
            if (this.parent) {
                this.parent.enter(message, ...params);
            } else {
                const indent = '  '.repeat(this.depth);
                console.log(indent + message, ...params);
                this.depth++;
            }
        }
    }

    leave(message?: any, ...params: any[]) {
        if (this.enabled) {
            if (this.parent) {
                this.parent.leave(message, ...params);
            } else {
                if (this.depth > 0) {
                    this.depth--;
                }
                if (message != null) {
                    const indent = '  '.repeat(this.depth);
                    console.log(indent + message, ...params);
                }
            }
        }
    }

    createChild(enabled: boolean): Trace {
        return new Trace(enabled, this);
    }

    static getDefault() {
        if (_default == null) {
            _default = new Trace(true);
        }
        return _default;
    }
}

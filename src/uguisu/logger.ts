let _logger: DebugLogger | null;

export class DebugLogger {
	parent?: DebugLogger;
	depth: number;
	enabled: boolean;

	constructor(enabled: boolean, parent?: DebugLogger) {
		this.parent = parent;
		this.depth = 0;
		this.enabled = enabled;
	}

	debug(message: any, ...params: any[]) {
		if (this.enabled) {
			if (this.parent) {
				this.parent.debug(message, ...params);
			} else {
				const indent = '  '.repeat(this.depth);
				console.log(indent + message, ...params);
			}
		}
	}

	debugEnter(message: any, ...params: any[]) {
		if (this.enabled) {
			if (this.parent) {
				this.parent.debugEnter(message, ...params);
			} else {
				const indent = '  '.repeat(this.depth);
				console.log(indent + message, ...params);
				this.depth++;
			}
		}
	}

	debugLeave(message?: any, ...params: any[]) {
		if (this.enabled) {
			if (this.parent) {
				this.parent.debugLeave(message, ...params);
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

	createChild(): DebugLogger {
		return new DebugLogger(false, this);
	}

	static getRootLogger() {
		if (_logger == null) {
			_logger = new DebugLogger(true);
		}
		return _logger;
	}
}

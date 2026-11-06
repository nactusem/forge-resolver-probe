// Stand-in for @forge/resolver.
//
// The real library keeps the functions you define on the resolver instance and looks one
// up by function key when the platform invokes your app. Each instance gets its own
// table here for the same reason: a probe usually loads two copies of a resolver in one
// process, the one you ship and a control, and a table shared between them would mean the
// second import quietly answers for the first.

export default class Resolver {
    constructor() {
        this.functions = new Map();
    }

    define(name, fn) {
        this.functions.set(name, fn);
        return this;
    }

    getDefinitions() {
        const functions = this.functions;
        return (event, extra = {}) => {
            const key = event?.call?.functionKey;
            // `has` rather than a property lookup: the real library uses `in`, which walks
            // the prototype chain and makes "constructor" and "toString" callable keys.
            if (typeof key !== 'string' || !functions.has(key)) {
                throw new Error(`no resolver is defined for "${key}"`);
            }
            return functions.get(key)({ payload: event.call.payload, context: { ...extra, ...event.context } });
        };
    }
}

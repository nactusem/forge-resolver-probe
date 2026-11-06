// Stand-in for @forge/kvs: a real store, in memory.
//
// This is the point of the whole harness. A resolver can answer anything it likes; what
// matters is what is in storage when the call is over. Values are cloned on the way in
// and out, so a caller that mutates what it read cannot quietly change what is stored.

export const store = new Map();
export const operations = [];

const clone = (value) => (value === undefined ? undefined : structuredClone(value));

export const kvs = {
    get: async (key) => {
        operations.push({ op: 'get', key });
        return clone(store.get(key));
    },
    set: async (key, value) => {
        operations.push({ op: 'set', key });
        store.set(key, clone(value));
    },
    delete: async (key) => {
        operations.push({ op: 'delete', key });
        store.delete(key);
    },
    query: () => {
        const query = {
            where: () => query,
            limit: () => query,
            cursor: () => query,
            getMany: async () => ({ results: [], nextCursor: undefined }),
        };
        return query;
    },
};

export const WhereConditions = { beginsWith: (prefix) => ({ prefix }) };

/** Empties the store and the operation log. Call it between runs. */
export const reset = () => {
    store.clear();
    operations.length = 0;
};

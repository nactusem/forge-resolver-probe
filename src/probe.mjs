// One run of a resolver, with the question a probe exists to answer: what is in storage
// when the call is over, and which client asked the product what.

import { kvs, store, operations, reset as resetStore } from './stubs/forge-kvs.mjs';
import { requests, respondWith, reset as resetApi } from './stubs/forge-api.mjs';

export { kvs, store, respondWith };

/**
 * @param {object}   options
 * @param {function} options.handler  the resolver's exported handler
 * @param {string}   options.functionKey
 * @param {object}   [options.payload]
 * @param {object}   [options.context]  what the platform would put in context, such as accountId
 * @param {object}   [options.seed]     storage contents before the call, as { key: value }
 * @param {function} [options.product]  answers product requests, see respondWith
 * @param {string[]} [options.watch]    storage keys to report on, defaults to the seeded keys
 */
export const probe = async ({
    handler, functionKey, payload = {}, context = {}, seed = {}, product, watch,
}) => {
    resetStore();
    resetApi();
    if (product) respondWith(product);
    for (const [key, value] of Object.entries(seed)) store.set(key, structuredClone(value));

    const keys = watch ?? Object.keys(seed);
    const before = Object.fromEntries(keys.map((key) => [key, store.has(key)]));

    const invocation = { call: { functionKey, payload } };
    let response;
    let error;
    try {
        response = await handler(invocation, context);
    } catch (err) {
        error = err;
    }

    const after = Object.fromEntries(keys.map((key) => [key, store.has(key)]));
    const deleted = keys.filter((key) => before[key] && !after[key]);

    return {
        request: invocation.call,
        context,
        response,
        error,
        existedBefore: before,
        existsAfter: after,
        deleted,
        survived: keys.filter((key) => before[key] && after[key]),
        storageOperations: operations.map(({ op, key }) => `${op} ${key}`),
        productRequests: requests.map((r) => `${r.as} ${r.method} ${r.path}`),
    };
};

/** A one line summary, the shape you paste into a report. */
export const line = (label, result) => [
    label,
    `request ${JSON.stringify(result.request)}`,
    `response ${JSON.stringify(result.response)}`,
    `deleted ${result.deleted.length ? result.deleted.join(', ') : '(nothing)'}`,
    `product ${result.productRequests.length ? result.productRequests.join(' | ') : '(no calls)'}`,
].join('\n  ');

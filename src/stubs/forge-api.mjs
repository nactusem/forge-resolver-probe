// Stand-in for @forge/api.
//
// Every product request is recorded together with the client that made it, asUser or
// asApp. That distinction is usually the interesting one: a permission check asked of
// the app instead of the caller is a bug you cannot see in a response body.
//
// Answers come from `respondWith`, which you set per run. The default answers nothing
// useful on purpose, so a resolver that depends on a product response has to say so.

export const requests = [];

let responder = () => ({});

/** Decide what the product returns. Receives { as, method, path, options }. */
export const respondWith = (fn) => { responder = fn; };

/** Forget every recorded request and go back to the default responder. */
export const reset = () => {
    requests.length = 0;
    responder = () => ({});
};

const client = (as) => ({
    requestJira: async (path, options = {}) => call(as, 'requestJira', path, options),
    requestConfluence: async (path, options = {}) => call(as, 'requestConfluence', path, options),
});

const call = (as, product, path, options) => {
    const request = { as, product, method: options.method || 'GET', path: String(path), options };
    requests.push(request);
    const answer = responder(request) ?? {};
    const { status = 200, body = answer } = answer.status ? answer : {};
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    };
};

export const route = (strings, ...values) =>
    strings.raw.reduce((acc, part, i) => acc + part + (values[i] ?? ''), '');

export const getAppContext = () => ({ environmentType: 'DEVELOPMENT', appVersion: 'probe' });

export default {
    asUser: () => client('asUser'),
    asApp: () => client('asApp'),
    fetch: async (url, options = {}) => {
        requests.push({ as: 'fetch', product: 'fetch', method: options.method || 'GET', path: String(url), options });
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    },
};

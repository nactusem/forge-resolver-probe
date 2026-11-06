import { test } from 'node:test';
import assert from 'node:assert/strict';

import Resolver from '../src/stubs/forge-resolver.mjs';
import { kvs, store } from '../src/stubs/forge-kvs.mjs';
import api, { requests, respondWith, reset as resetApi } from '../src/stubs/forge-api.mjs';
import { probe } from '../src/probe.mjs';
import { handler as guarded } from '../example/notes-resolver.js';
import { handler as unguarded } from '../example/notes-resolver-unguarded.js';

const NOTE = { id: 'n-1', text: 'hello', authorAccountId: 'author' };
const KEY = 'note:n-1';
const seed = () => ({ [KEY]: NOTE });
const admin = (yes) => ({ path }) =>
    (path.includes('/permissions/check') ? { globalPermissions: yes ? ['ADMINISTER'] : [] } : {});

test('two resolvers in one process keep their own functions', () => {
    // The bug this file exists for: a table shared between instances means the second
    // module imported answers for the first, and a control run silently tests nothing.
    const first = new Resolver();
    const second = new Resolver();
    first.define('who', async () => 'first');
    second.define('who', async () => 'second');

    const ask = (handler) => handler({ call: { functionKey: 'who', payload: {} } });
    assert.equal(ask(first.getDefinitions()) instanceof Promise, true);
    return Promise.all([ask(first.getDefinitions()), ask(second.getDefinitions())])
        .then(([a, b]) => {
            assert.equal(a, 'first');
            assert.equal(b, 'second');
        });
});

test('an undeclared function key is refused rather than resolved up the prototype chain', () => {
    const handler = new Resolver().define('real', async () => 'ok').getDefinitions();
    assert.throws(() => handler({ call: { functionKey: 'constructor', payload: {} } }), /no resolver/);
    assert.throws(() => handler({ call: { functionKey: 'toString', payload: {} } }), /no resolver/);
});

test('the probe reports what survived, not what the response said', async () => {
    const stranger = await probe({
        handler: guarded,
        functionKey: 'deleteNote',
        payload: { id: 'n-1' },
        context: { accountId: 'someone-else' },
        seed: seed(),
        product: admin(false),
    });

    assert.deepEqual(stranger.response, { status: 'ok', deleted: true });
    assert.deepEqual(stranger.deleted, []);
    assert.deepEqual(stranger.survived, [KEY]);
});

test('the control deletes, so an empty result elsewhere means something', async () => {
    const control = await probe({
        handler: unguarded,
        functionKey: 'deleteNote',
        payload: { id: 'n-1' },
        context: { accountId: 'someone-else' },
        seed: seed(),
        product: admin(false),
    });

    assert.deepEqual(control.deleted, [KEY]);
});

test('product requests record the client that made them', async () => {
    const moderated = await probe({
        handler: guarded,
        functionKey: 'deleteNote',
        payload: { id: 'n-1' },
        context: { accountId: 'an-admin' },
        seed: seed(),
        product: admin(true),
    });

    assert.deepEqual(moderated.deleted, [KEY]);
    assert.deepEqual(moderated.productRequests, ['asUser POST /rest/api/3/permissions/check']);
});

test('storage hands out copies, so a caller cannot change what is stored by accident', async () => {
    store.clear();
    await kvs.set('k', { nested: { n: 1 } });
    const read = await kvs.get('k');
    read.nested.n = 99;
    assert.equal((await kvs.get('k')).nested.n, 1);
});

test('a product answer can carry a status, and a failure is not an exception', async () => {
    resetApi();
    respondWith(() => ({ status: 403, body: { message: 'nope' } }));
    const response = await api.asApp().requestJira('/rest/api/3/myself');
    assert.equal(response.ok, false);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { message: 'nope' });
    assert.deepEqual(requests.map((r) => r.as), ['asApp']);
});

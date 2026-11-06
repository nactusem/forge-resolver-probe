# forge-resolver-probe

**The response said ok. Was the row deleted?**

An Atlassian Forge resolver can only be run inside Forge, so the usual way to check what one does is to
read it, deploy it, click around, and trust the response body. A response body is the one thing an
authorization bug does not have to tell the truth about: an endpoint can answer `{"deleted": true}` to
everybody and delete nothing, or answer nothing at all and delete everything.

This loads your resolver on your machine, calls it the way the platform would, and reports what is left in
storage afterwards. No deploy, no tunnel, no site.

```
a stranger asks for the author's note
  request {"functionKey":"deleteNote","payload":{"id":"n-42"}}
  response {"status":"ok","deleted":true}
  deleted (nothing)
  product asUser POST /rest/api/3/permissions/check
```

That is the output you can paste into a security report, a pull request, or an answer to a bug bounty
researcher who is sure your app deletes other people's data.

## How it works

Two things stand between `import { handler } from '../src/index.js'` and a resolver that runs under Node:

1. the `@forge/*` packages, which exist only in the Forge runtime, and
2. extensionless relative imports, which the Forge build resolves and Node does not.

A module loader handles both. `@forge/resolver`, `@forge/kvs`, `@forge/api` and `@forge/llm` are redirected
to stand-ins; everything else resolves normally, so **the code under test is the code you ship**. Storage is a
real in-memory store rather than a mock with expectations, because the question is what survives, not which
function was called.

```
node --import ./src/register.mjs your-probe.mjs
```

```js
import { probe, line } from 'forge-resolver-probe/src/probe.mjs';
import { handler } from '../src/index.js';

const result = await probe({
  handler,
  functionKey: 'deleteNote',
  payload: { id: 'n-42' },
  context: { accountId: 'someone-else' },      // what the platform puts in context
  seed: { 'note:n-42': { authorAccountId: 'the-author' } },
  product: ({ path }) =>                        // what the product answers
    (path.includes('/permissions/check') ? { globalPermissions: [] } : {}),
});

result.response;          // { status: 'ok', deleted: true }
result.deleted;           // []          <- the keys that are gone
result.survived;          // ['note:n-42']
result.productRequests;   // ['asUser POST /rest/api/3/permissions/check']
```

`productRequests` records the client each call used, `asUser` or `asApp`. A permission check asked of the app
instead of the caller is a real bug and it is invisible in a response body.

## Always run a control

A probe that reports "nothing was deleted" proves nothing on its own. It could be measuring a call that never
arrived. Copy the resolver, remove the check you are relying on, and run the same call again: if the control
does not delete, your probe cannot see deletions and its other runs are worthless.

`example/` is that pattern end to end. `npm run example` runs five calls against a small notes resolver: a
stranger, a stranger asking for an id that does not exist, the author, an admin, and the control with the
ownership comparison removed. The last one is the only reason to believe the first.

## What we learned building it

* **The control found a bug in the harness itself.** The first version kept resolver definitions in one
  module level table. Importing two copies of a resolver, the real one and the control, meant the second
  import silently answered for the first, so every run was testing the control. The stand-in now gives each
  `Resolver` instance its own table, and a test pins it.
* **`in` is not `has`.** The real library looks a function key up with `in`, which walks the prototype chain,
  so `constructor` and `toString` resolve to something. The stand-in refuses anything that was not defined,
  which is also what your app should do.
* **Reads should hand out copies.** A mock that returns the stored object by reference lets a caller mutate
  storage by accident, and then a test passes for the wrong reason.

## What it is not

It is not a Forge emulator. There is no tunnel, no queue, no scheduled trigger, no real product, and no
tenancy. It answers one narrow question well: given this call, from this account, what did the resolver do to
storage and what did it ask the product.

## Install

Copy `src/` into your app, or add the package and point `--import` at `src/register.mjs`. No dependencies,
Node 20.6 or newer.

```
npm test        # the harness, seven tests
npm run example # the five runs above
```

MIT © [Mesut Can](https://mesutcan.dev)

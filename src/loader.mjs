// Module hooks that let a Forge resolver load outside Forge.
//
// Two things stand between `import resolver from '../src/index.js'` and a resolver
// that runs on your machine:
//
//   1. the `@forge/*` packages, which only exist inside the Forge runtime, and
//   2. extensionless relative imports, which the Forge build resolves and Node does not.
//
// Both are handled here. Everything else resolves normally, so the resolver you load
// is the one you ship.

const STUBS = {
    '@forge/resolver': './stubs/forge-resolver.mjs',
    '@forge/kvs': './stubs/forge-kvs.mjs',
    '@forge/api': './stubs/forge-api.mjs',
    '@forge/llm': './stubs/forge-llm.mjs',
};

export async function resolve(specifier, context, nextResolve) {
    const stub = STUBS[specifier];
    if (stub) return nextResolve(new URL(stub, import.meta.url).href, context);

    try {
        return await nextResolve(specifier, context);
    } catch (err) {
        const extensionless = specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier);
        if (extensionless) return nextResolve(`${specifier}.js`, context);
        throw err;
    }
}

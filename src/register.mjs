// Registers the loader. Use it with Node's --import flag:
//
//   node --import ./src/register.mjs your-probe.mjs
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./loader.mjs', import.meta.url), pathToFileURL('./'));

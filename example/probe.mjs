// Four runs and a control, the shape of a probe that can be quoted in a report.
//
//   npm run example

import { probe, line } from '../src/probe.mjs';
import { handler as guarded } from './notes-resolver.js';
import { handler as unguarded } from './notes-resolver-unguarded.js';

const AUTHOR = 'author-1';
const SOMEONE_ELSE = 'account-2';
const ADMIN = 'admin-1';
const NOTE_ID = 'n-42';
const KEY = `note:${NOTE_ID}`;

const note = { id: NOTE_ID, text: 'the quarterly numbers', authorAccountId: AUTHOR };

/** Answers the permission check. Only the admin run says yes. */
const permissions = (admin) => ({ path }) =>
    (path.includes('/permissions/check') ? { globalPermissions: admin ? ['ADMINISTER'] : [] } : {});

const run = (label, { handler, accountId, id = NOTE_ID, admin = false }) =>
    probe({
        handler,
        functionKey: 'deleteNote',
        payload: { id },
        context: { accountId },
        seed: { [KEY]: note },
        product: permissions(admin),
    }).then((result) => {
        console.log(line(label, result));
        console.log();
        return result;
    });

const results = {
    stranger: await run('a stranger asks for the author\'s note', { handler: guarded, accountId: SOMEONE_ELSE }),
    missing: await run('the same stranger asks for an id that does not exist', { handler: guarded, accountId: SOMEONE_ELSE, id: 'no-such-note' }),
    author: await run('the author asks for their own note', { handler: guarded, accountId: AUTHOR }),
    admin: await run('an admin moderates the note', { handler: guarded, accountId: ADMIN, admin: true }),
    control: await run('CONTROL: the stranger, against the copy with no author comparison', { handler: unguarded, accountId: SOMEONE_ELSE }),
};

const checks = {
    'the stranger is answered exactly like a missing id':
        JSON.stringify(results.stranger.response) === JSON.stringify(results.missing.response),
    'the stranger deletes nothing': results.stranger.deleted.length === 0,
    'the author deletes their own note': results.author.deleted.includes(KEY),
    'an admin can moderate': results.admin.deleted.includes(KEY),
    'the control DOES delete, so the probe can see a deletion': results.control.deleted.includes(KEY),
};

for (const [what, held] of Object.entries(checks)) console.log(`${held ? 'PASS' : 'FAIL'}  ${what}`);
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;

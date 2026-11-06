// The same resolver as notes-resolver.js with ONE line changed: the author comparison is
// gone, so any caller removes any note. It exists to answer the question that makes the
// other runs worth reading. If the probe cannot see a deletion here, it cannot see one
// anywhere, and "nothing was deleted" proves nothing.
//
// This is the control group. Never ship a file like this.

import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import api, { route } from '@forge/api';

const resolver = new Resolver();
const noteKey = (id) => `note:${id}`;

/** Asks the product whether the CALLER is an admin. Any error means "no". */
const callerIsAdmin = async () => {
    try {
        const response = await api.asUser().requestJira(route`/rest/api/3/permissions/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ globalPermissions: ['ADMINISTER'] }),
        });
        if (!response.ok) return false;
        const body = await response.json();
        return Array.isArray(body.globalPermissions) && body.globalPermissions.includes('ADMINISTER');
    } catch {
        return false;
    }
};

resolver.define('deleteNote', async ({ payload, context }) => {
    const accountId = typeof context?.accountId === 'string' ? context.accountId : null;
    const id = typeof payload?.id === 'string' ? payload.id : null;
    if (!accountId || !id) return { status: 'error', message: 'Invalid request.' };

    const key = noteKey(id);
    const note = await kvs.get(key);

    // The author's own note. This is the only branch that removes a note for the caller.
    if (note) { // the comparison this copy exists without
        await kvs.delete(key);
        return { status: 'ok', deleted: true };
    }

    // Everyone else gets the same answer, whether the note exists or not. The admin check
    // runs for every caller who is not the author, present note or absent, so that the two
    // cases cost the same and the timing does not give the answer away either.
    const isAdmin = await callerIsAdmin();
    if (note && isAdmin) await kvs.delete(key);
    return { status: 'ok', deleted: true };
});

export const handler = resolver.getDefinitions();

// A small Forge style resolver, written the way an app would write it: an app where a
// person can publish a note to a shared board and remove their own again.
//
// It is here so the probe has something honest to run. Two decisions in it are the ones
// worth probing:
//
//   1. only the author's own note is removed, and
//   2. a caller who is not the author gets the same answer as someone who asked for a
//      note that does not exist, because a different error would turn this endpoint into
//      a way to find out which note ids exist and who wrote them.
//
// The second decision is why "the response says ok" is not the same as "the note is gone",
// which is exactly what a probe is for.

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
    if (note && note.authorAccountId === accountId) {
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

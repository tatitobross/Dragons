import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const requireFunctions = createRequire(new URL('../../functions/index.js', import.meta.url));
let documents;
let accessedPaths;
let authCalls;
let profileWriteError;

class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}

const auth = {
    async createUser(values) { authCalls.push(['create', values]); return { uid: 'new-account' }; },
    async updateUser(uid, values) { authCalls.push(['update', uid, values]); },
    async deleteUser(uid) { authCalls.push(['delete', uid]); },
};

const db = {
    doc(path) {
        accessedPaths.push(path);
        return {
            async get() { return { exists: documents.has(path), data: () => structuredClone(documents.get(path)) }; },
            async set(values, options) {
                if (profileWriteError) throw profileWriteError;
                documents.set(path, options?.merge ? { ...documents.get(path), ...values } : structuredClone(values));
            },
            async delete() { documents.delete(path); },
        };
    },
};

mock.module(pathToFileURL(requireFunctions.resolve('firebase-functions/v2/https')).href, { exports: { HttpsError, onCall: handler => handler } });
for (const [service, exports] of [
    ['app', { getApps: () => [{}], initializeApp: () => {} }],
    ['auth', { getAuth: () => auth }],
    ['firestore', { getFirestore: () => db }],
]) {
    const modulePath = requireFunctions.resolve(`firebase-admin/${service}`).replace(/([\\/])lib([\\/])/, '$1lib$2esm$2');
    mock.module(pathToFileURL(modulePath).href, { exports });
}

const { createPlayer, updatePlayer, deletePlayer } = await import('../../functions/index.js');

beforeEach(() => {
    documents = new Map([
        ['users/coach', { name: 'Entrenador', role: 'admin' }],
        ['users/account', { name: 'Ana', role: 'player', phone: '+50412345678' }],
        ['rosterPlayers/manual-player', { name: 'Nombre elegido por entrenador', source: 'manual' }],
    ]);
    accessedPaths = [];
    authCalls = [];
    profileWriteError = null;
});

test('creating an access account does not create or match an attendance player', async () => {
    const rosterBefore = structuredClone(documents.get('rosterPlayers/manual-player'));
    const result = await createPlayer({ auth: { uid: 'coach' }, data: { name: 'Nombre elegido por entrenador', email: 'player@example.com', phone: '+50412345678', tempPassword: 'temporary-password' } });

    assert.deepEqual(result, { uid: 'new-account' });
    assert.equal(documents.get('users/new-account').role, 'player');
    assert.deepEqual(documents.get('rosterPlayers/manual-player'), rosterBefore);
    assert.equal([...documents.keys()].filter(path => path.startsWith('rosterPlayers/')).length, 1);
    assert.equal(accessedPaths.every(path => path.startsWith('users/')), true);
});

test('editing account name and password leaves the coach-maintained attendance name intact', async () => {
    const result = await updatePlayer({ auth: { uid: 'coach' }, data: { uid: 'account', name: 'Nombre nuevo de cuenta', password: 'new-password', rosterPlayerId: 'manual-player' } });

    assert.deepEqual(result, { uid: 'account' });
    assert.equal(documents.get('users/account').name, 'Nombre nuevo de cuenta');
    assert.equal(documents.get('rosterPlayers/manual-player').name, 'Nombre elegido por entrenador');
    assert.equal(accessedPaths.every(path => path.startsWith('users/')), true);
    assert.deepEqual(authCalls[0], ['update', 'account', { displayName: 'Nombre nuevo de cuenta', password: 'new-password' }]);
});

test('deleting an access account preserves attendance entries and their legacy identifiers', async () => {
    const legacy = { name: 'Atleta manual anterior', userId: 'account', aliasIds: ['old-id'], source: 'manual' };
    documents.set('rosterPlayers/manual-player', structuredClone(legacy));
    await deletePlayer({ auth: { uid: 'coach' }, data: { uid: 'account' } });

    assert.equal(documents.has('users/account'), false);
    assert.deepEqual(documents.get('rosterPlayers/manual-player'), legacy);
    assert.deepEqual(authCalls, [['delete', 'account']]);
    assert.equal(accessedPaths.every(path => path.startsWith('users/')), true);
});

test('a failed profile write rolls back only the newly created access account', async () => {
    profileWriteError = new Error('Profile write failed');
    await assert.rejects(createPlayer({ auth: { uid: 'coach' }, data: { name: 'Ana', email: 'player@example.com', phone: '+50412345678', tempPassword: 'temporary-password' } }), /Profile write failed/);

    assert.equal(documents.has('users/new-account'), false);
    assert.deepEqual(authCalls[1], ['delete', 'new-account']);
    assert.equal(documents.get('rosterPlayers/manual-player').source, 'manual');
});

test('only an administrator can manage access accounts', async () => {
    await assert.rejects(updatePlayer({ auth: { uid: 'account' }, data: { uid: 'account', name: 'Otra' } }), error => error.code === 'permission-denied');
    await assert.rejects(createPlayer({ data: {} }), error => error.code === 'unauthenticated');
    assert.deepEqual(authCalls, []);
});

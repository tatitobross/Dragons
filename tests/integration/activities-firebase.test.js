import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

const db = {}, auth = { currentUser: { uid: 'coach' } };
let documents, versions, nextId, afterRead, failure, subscription;
const seed = (path, value) => { documents.set(path, structuredClone(value)); versions.set(path, (versions.get(path) || 0) + 1); };
mock.module('firebase/firestore', { exports: {
    collection: (_db, path) => ({ path }),
    doc(target, ...parts) {
        const path = target === db ? parts.join('/') : `${target.path}/new-${++nextId}`;
        return { path, id: path.split('/').at(-1) };
    },
    async setDoc(reference, value) { if (failure) throw failure; seed(reference.path, value); },
    async deleteDoc(reference) { if (failure) throw failure; documents.delete(reference.path); },
    onSnapshot(reference, callback, onError) { subscription = { reference, callback, onError, stopped: false }; return () => { subscription.stopped = true; }; },
    async runTransaction(database, callback) {
        assert.equal(database, db);
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const reads = new Map(), writes = [];
            await callback({
                async get(reference) {
                    const value = structuredClone(documents.get(reference.path));
                    reads.set(reference.path, versions.get(reference.path) || 0);
                    const hook = afterRead; afterRead = null; hook?.();
                    return { exists: () => value !== undefined, data: () => structuredClone(value) };
                },
                update(reference, values) { writes.push([reference.path, structuredClone(values)]); },
            });
            if ([...reads].some(([path, version]) => versions.get(path) !== version)) continue;
            if (failure) throw failure;
            for (const [path, value] of writes) seed(path, { ...documents.get(path), ...value });
            return;
        }
        throw new Error('Transaction retries exceeded.');
    },
} });
mock.module(new URL('../../resources/js/firebase.js', import.meta.url).href, { exports: { auth, db } });
const api = await import('../../resources/js/activities-firebase.js');

beforeEach(() => {
    documents = new Map(); versions = new Map(); nextId = 0; afterRead = null; failure = null; subscription = null;
    auth.currentUser = { uid: 'coach' };
    seed('activities/rifa', { title: 'Rifa', date: '', participants: {
        ana: { name: 'Ana', detail: 'Boletos 1–10', status: 'pending' },
        luis: { name: 'Luis', detail: '', status: 'paid' },
    } });
    seed('users/account', { name: 'Cuenta' }); seed('rosterPlayers/athlete', { name: 'Atleta' });
});

test('creates an independent activity with no automatic account or attendance entries', async () => {
    const id = await api.createActivity({ title: ' Cena del club ', date: '2026-11-10' });
    assert.equal(documents.get(`activities/${id}`).title, 'Cena del club');
    assert.deepEqual(documents.get(`activities/${id}`).participants, {});
    assert.equal(documents.get(`activities/${id}`).createdBy, 'coach');
    assert.equal(documents.size, 4);
});
test('manually records a delivery as pending without requiring a website account', async () => {
    const id = await api.addActivityParticipant('rifa', { name: ' Marta ', detail: ' Boletos 11–20 ' });
    const activity = documents.get('activities/rifa');
    assert.deepEqual({ ...activity.participants[id], createdAt: '' }, { name: 'Marta', detail: 'Boletos 11–20', status: 'pending', createdAt: '' });
    assert.equal(activity.participants.luis.status, 'paid');
    assert.equal(documents.size, 3);
});
test('payment can be marked paid or pending without losing delivery details', async () => {
    await api.setActivityPayment('rifa', 'ana', 'paid');
    let person = documents.get('activities/rifa').participants.ana;
    assert.equal(person.status, 'paid'); assert.ok(person.paidAt); assert.equal(person.detail, 'Boletos 1–10');
    await api.setActivityPayment('rifa', 'ana', 'pending');
    person = documents.get('activities/rifa').participants.ana;
    assert.equal(person.status, 'pending'); assert.equal(person.paidAt, null);
    assert.equal(documents.get('activities/rifa').participants.luis.status, 'paid');
});
test('editing activity and person names preserves all payments', async () => {
    await api.updateActivity('rifa', { title: 'Rifa de diciembre', date: '' });
    await api.updateActivityParticipant('rifa', 'luis', { name: 'Luis Pérez', detail: 'Boletos 21–30' });
    const activity = documents.get('activities/rifa');
    assert.equal(activity.title, 'Rifa de diciembre');
    assert.equal(activity.participants.luis.status, 'paid');
    assert.equal(activity.participants.ana.status, 'pending');
});
test('a concurrent payment change for another person survives transaction retry', async () => {
    afterRead = () => {
        const activity = documents.get('activities/rifa');
        seed('activities/rifa', { ...activity, participants: { ...activity.participants, luis: { ...activity.participants.luis, status: 'pending' } } });
    };
    await api.setActivityPayment('rifa', 'ana', 'paid');
    assert.equal(documents.get('activities/rifa').participants.ana.status, 'paid');
    assert.equal(documents.get('activities/rifa').participants.luis.status, 'pending');
});
test('removing a person affects only this activity and stale editors cannot recreate them', async () => {
    await api.removeActivityParticipant('rifa', 'ana');
    await assert.rejects(api.setActivityPayment('rifa', 'ana', 'paid'), /ya no está/);
    await assert.rejects(api.updateActivityParticipant('rifa', 'ana', { name: 'Ana' }), /ya no está/);
    assert.equal(documents.get('activities/rifa').participants.luis.status, 'paid');
    assert.equal(documents.has('users/account'), true); assert.equal(documents.has('rosterPlayers/athlete'), true);
});
test('deleting an activity removes its deliveries while retaining unrelated lists and accounts', async () => {
    const other = await api.createActivity({ title: 'Otra rifa' });
    await api.deleteActivity('rifa');
    assert.equal(documents.has('activities/rifa'), false); assert.equal(documents.has(`activities/${other}`), true);
    assert.equal(documents.has('users/account'), true); assert.equal(documents.has('rosterPlayers/athlete'), true);
    await assert.rejects(api.addActivityParticipant('rifa', { name: 'Ana' }), /ya no existe/);
});
test('invalid states and denied writes leave the stored payments untouched', async () => {
    const before = structuredClone([...documents]);
    await assert.rejects(api.setActivityPayment('rifa', 'ana', 'invalid'), /Pendiente o Pagado/);
    failure = new Error('permission-denied');
    await assert.rejects(api.setActivityPayment('rifa', 'ana', 'paid'), /permission-denied/);
    assert.deepEqual([...documents], before);
});
test('signed-out clients cannot create or modify an activity', async () => {
    auth.currentUser = null;
    await assert.rejects(api.createActivity({ title: 'Rifa' }), /Inicia sesión/);
    await assert.rejects(api.deleteActivity('rifa'), /Inicia sesión/);
    await assert.rejects(api.setActivityPayment('rifa', 'ana', 'paid'), /Inicia sesión/);
});
test('activity subscriptions return newest lists first and support cleanup', () => {
    let received;
    const stop = api.watchActivities(value => { received = value; }, () => {});
    assert.equal(subscription.reference.path, 'activities');
    subscription.callback({ docs: [
        { id: 'old', data: () => ({ title: 'Vieja', createdAt: '2026-10-01' }) },
        { id: 'new', data: () => ({ title: 'Nueva', createdAt: '2026-10-29' }) },
    ] });
    assert.deepEqual(received.map(item => item.id), ['new', 'old']);
    stop(); assert.equal(subscription.stopped, true);
});

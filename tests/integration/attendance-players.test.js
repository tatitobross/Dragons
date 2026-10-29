import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { attendancePlayersForSession } from '../../resources/js/roster.js';

const db = {}, auth = { currentUser: { uid: 'coach' } };
let documents, versions, failure, afterRead;
const seed = (path, value) => { documents.set(path, structuredClone(value)); versions.set(path, (versions.get(path) || 0) + 1); };
mock.module('firebase/firestore', { exports: {
    doc: (_db, ...parts) => parts.join('/'),
    async runTransaction(_db, callback) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const reads = new Map(), writes = [];
            await callback({
                async get(path) {
                    const value = structuredClone(documents.get(path)); reads.set(path, versions.get(path) || 0);
                    const hook = afterRead; afterRead = null; hook?.();
                    return { exists: () => value !== undefined, data: () => value };
                },
                update: (path, value) => writes.push({ path, value, merge: true }),
                set: (path, value) => writes.push({ path, value }),
            });
            if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) continue;
            if (failure) throw failure;
            for (const write of writes) seed(write.path, write.merge ? { ...documents.get(write.path), ...write.value } : write.value);
            return;
        }
        throw new Error('Transaction retries exceeded.');
    },
} });
mock.module(new URL('../../resources/js/firebase.js', import.meta.url).href, { exports: { auth, db } });
const { removePlayerFromAttendance } = await import('../../resources/js/attendance-players-firebase.js');
beforeEach(() => {
    documents = new Map(); versions = new Map(); failure = null; afterRead = null; auth.currentUser = { uid: 'coach' };
    seed('rosterPlayers/ana', { name: 'Ana', source: 'manual', aliasIds: ['old-ana'] });
    seed('attendance/current', { date: '2026-10-25', records: { 'old-ana': { status: 'asistio', paymentStatus: 'debe', debtAmount: '50' }, other: { status: 'asistio', paymentStatus: 'pago' } } });
    seed('attendance/past', { date: '2026-10-24', records: { 'old-ana': { status: 'asistio' } } });
    seed('attendance/future', { date: '2026-10-30', records: {} });
    seed('users/ana', { name: 'Ana' });
});
test('retires from this list and every later date while retaining older attendance and the account', async () => {
    const before = structuredClone(documents.get('attendance/past'));
    const records = structuredClone(documents.get('attendance/current').records);
    await removePlayerFromAttendance('current', 'ana');
    const person = { id: 'ana', ...documents.get('rosterPlayers/ana') };
    assert.equal(person.attendanceExcludedFrom, '2026-10-25');
    assert.deepEqual(attendancePlayersForSession(documents.get('attendance/past'), [person]), [person]);
    for (const id of ['current', 'future']) assert.deepEqual(attendancePlayersForSession(documents.get(`attendance/${id}`), [person]), []);
    assert.deepEqual(attendancePlayersForSession({ date: '2027-01-01' }, [person]), []);
    assert.deepEqual(documents.get('attendance/past'), before);
    assert.deepEqual(documents.get('attendance/current').records, records);
    assert.equal(documents.has('users/ana'), true); assert.equal(person.archived, undefined);
    const summary = documents.get('attendancePublic/current');
    assert.deepEqual(summary.excludedPlayerIds, ['ana', 'old-ana']);
    assert.equal(summary.records['old-ana'], undefined);
    assert.equal(summary.records.other.paymentStatus, 'pago');
});
test('a subsequent removal cannot move the retirement date forward and revive an earlier list', async () => {
    await removePlayerFromAttendance('current', 'ana');
    await removePlayerFromAttendance('future', 'ana');
    assert.equal(documents.get('rosterPlayers/ana').attendanceExcludedFrom, '2026-10-25');
});
test('a concurrent payment change is preserved when retiring a player', async () => {
    afterRead = () => {
        const session = documents.get('attendance/current');
        seed('attendance/current', { ...session, records: { ...session.records, other: { status: 'asistio', paymentStatus: 'debe', debtAmount: '80' } } });
    };
    await removePlayerFromAttendance('current', 'ana');
    assert.equal(documents.get('attendance/current').records.other.debtAmount, '80');
    assert.equal(documents.get('attendancePublic/current').records.other.paymentStatus, 'debe');
    assert.equal(documents.get('attendancePublic/current').records.other.debtAmount, undefined);
});
test('denied commits change neither the roster nor the list', async () => {
    const before = structuredClone([...documents]); failure = new Error('permission-denied');
    await assert.rejects(removePlayerFromAttendance('current', 'ana'), /permission-denied/);
    assert.deepEqual([...documents], before);
});
test('missing lists, missing athletes and signed-out sessions cannot retire anyone', async () => {
    await assert.rejects(removePlayerFromAttendance('missing', 'ana'), /ya no existe/);
    await assert.rejects(removePlayerFromAttendance('current', 'missing'), /ya no existe/);
    auth.currentUser = null;
    await assert.rejects(removePlayerFromAttendance('current', 'ana'), /Inicia sesión/);
    assert.equal(documents.get('rosterPlayers/ana').attendanceExcludedFrom, undefined);
});

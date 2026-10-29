import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

const db = {};
const auth = { currentUser: { uid: 'coach' } };
let documents, versions, commitError, afterRead;

function seed(path, value) {
    documents.set(path, structuredClone(value));
    versions.set(path, (versions.get(path) || 0) + 1);
}

mock.module('firebase/firestore', { exports: {
    doc: (database, ...parts) => { assert.equal(database, db); return parts.join('/'); },
    async runTransaction(database, callback) {
        assert.equal(database, db);
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const reads = new Map(); const writes = [];
            await callback({
                async get(path) {
                    const data = structuredClone(documents.get(path));
                    reads.set(path, versions.get(path) || 0);
                    const hook = afterRead; afterRead = null; hook?.();
                    return { exists: () => data !== undefined, data: () => structuredClone(data) };
                },
                update: (path, value) => writes.push({ type: 'update', path, value }),
                set: (path, value) => writes.push({ type: 'set', path, value }),
                delete: path => writes.push({ type: 'delete', path }),
            });
            if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) continue;
            if (commitError) throw commitError;
            for (const { type, path, value } of writes) {
                if (type === 'delete') { documents.delete(path); versions.set(path, (versions.get(path) || 0) + 1); }
                else seed(path, type === 'update' ? { ...documents.get(path), ...value } : value);
            }
            return;
        }
        throw new Error('Transaction retries exceeded.');
    },
} });
mock.module(new URL('../../resources/js/firebase.js', import.meta.url).href, { exports: { db, auth } });

const { updateAttendanceSessionDate, updateAttendanceSessionDetails, deleteAttendanceSession } = await import('../../resources/js/attendance-session-firebase.js');

beforeEach(() => {
    documents = new Map(); versions = new Map(); commitError = null; afterRead = null;
    auth.currentUser = { uid: 'coach' };
    seed('attendance/session-1', {
        date: '2026-10-25', createdAt: '2026-10-21T15:00:00Z',
        records: { athlete: { status: 'asistio', paymentStatus: 'debe', debtAmount: '50' }, absent: { status: 'falto' } },
    });
    seed('attendancePublic/session-1', { date: '2026-10-25', records: {} });
    seed('attendance/other-session', { date: '2026-10-26', records: {} });
    seed('users/athlete', { name: 'Atleta' }); seed('rosterPlayers/athlete', { name: 'Atleta' });
});

test('changes the date in both views while preserving attendance, payments and identity', async () => {
    const original = structuredClone(documents.get('attendance/session-1'));
    await updateAttendanceSessionDate('session-1', '2026-10-26');
    assert.deepEqual(documents.get('attendance/session-1'), { ...original, date: '2026-10-26' });
    assert.deepEqual(documents.get('attendancePublic/session-1'), {
        date: '2026-10-26', createdAt: original.createdAt,
        records: { athlete: { status: 'asistio', paymentStatus: 'debe' }, absent: { status: 'falto' } },
    });
    assert.deepEqual(documents.get('attendance/other-session'), { date: '2026-10-26', records: {} });
});

test('preserves a simultaneous payment change on transaction retry', async () => {
    afterRead = () => seed('attendance/session-1', {
        ...documents.get('attendance/session-1'), records: { athlete: { status: 'asistio', paymentStatus: 'pago' } },
    });
    await updateAttendanceSessionDate('session-1', '2026-10-27');
    assert.equal(documents.get('attendance/session-1').records.athlete.paymentStatus, 'pago');
    assert.equal(documents.get('attendancePublic/session-1').records.athlete.paymentStatus, 'pago');
});

test('renames a legacy list for both roles without changing attendance or exposing debt amounts', async () => {
    const original = structuredClone(documents.get('attendance/session-1'));
    await updateAttendanceSessionDetails('session-1', { title: '  Cena del equipo  ', date: original.date });
    assert.deepEqual(documents.get('attendance/session-1'), { ...original, title: 'Cena del equipo' });
    const summary = documents.get('attendancePublic/session-1');
    assert.equal(summary.title, 'Cena del equipo');
    assert.equal(summary.records.athlete.paymentStatus, 'debe');
    assert.equal('debtAmount' in summary.records.athlete, false);
    // A subsequent date correction must retain the custom name in both copies.
    await updateAttendanceSessionDate('session-1', '2026-10-27');
    assert.equal(documents.get('attendance/session-1').title, 'Cena del equipo');
    assert.equal(documents.get('attendancePublic/session-1').title, 'Cena del equipo');
});

test('rejects blank and oversized list names before changing either view', async () => {
    const original = structuredClone([...documents]);
    for (const title of ['', '   ', 'a'.repeat(121), null, 123]) {
        await assert.rejects(updateAttendanceSessionDetails('session-1', { title, date: '2026-10-25' }), /nombre/);
    }
    assert.deepEqual([...documents], original);
});

test('rejects invalid dates without changing either view', async () => {
    const original = structuredClone([...documents]);
    for (const date of ['', '2026-02-30', '2026-13-01', '2026-2-1', '0000-01-01', null]) {
        await assert.rejects(updateAttendanceSessionDate('session-1', date), /fecha válida/);
    }
    assert.deepEqual([...documents], original);
});

test('does not recreate a list deleted while its editor was open', async () => {
    documents.delete('attendance/session-1'); documents.delete('attendancePublic/session-1');
    await assert.rejects(updateAttendanceSessionDate('session-1', '2026-10-27'), /ya no existe/);
    assert.equal(documents.has('attendance/session-1'), false);
    assert.equal(documents.has('attendancePublic/session-1'), false);
});

test('deletes both views without deleting athletes, accounts or other sessions', async () => {
    await deleteAttendanceSession('session-1');
    assert.equal(documents.has('attendance/session-1'), false);
    assert.equal(documents.has('attendancePublic/session-1'), false);
    assert.equal(documents.has('attendance/other-session'), true);
    assert.equal(documents.has('users/athlete'), true);
    assert.equal(documents.has('rosterPlayers/athlete'), true);
    await deleteAttendanceSession('session-1'); // A repeated click cannot recreate a copy.
    assert.equal(documents.has('attendancePublic/session-1'), false);
});

test('failed or unauthorized commits leave both copies untouched', async () => {
    const original = structuredClone([...documents]);
    commitError = new Error('permission-denied');
    await assert.rejects(deleteAttendanceSession('session-1'), /permission-denied/);
    await assert.rejects(updateAttendanceSessionDate('session-1', '2026-10-27'), /permission-denied/);
    assert.deepEqual([...documents], original);
});

test('requires a signed-in account and a valid session identifier', async () => {
    auth.currentUser = null;
    await assert.rejects(deleteAttendanceSession('session-1'), /Inicia sesión/);
    auth.currentUser = { uid: 'coach' };
    await assert.rejects(updateAttendanceSessionDate('../users/athlete', '2026-10-27'), /no es válida/);
    await assert.rejects(deleteAttendanceSession(''), /no es válida/);
});

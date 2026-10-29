import test from 'node:test';
import assert from 'node:assert/strict';
import { getPendingAttendancePlayerIds, markPendingRecordsAbsent } from '../../resources/js/attendance.js';

test('marks only blank or missing attendance and preserves recorded attendance and payments', () => {
    const records = {
        blank: { status: '' },
        attended: { status: 'asistio', paymentStatus: 'pago', debtAmount: '' },
        debtor: { status: 'asistio', paymentStatus: 'debe', debtAmount: '50' },
        absent: { status: 'falto' },
        other: { status: 'excused' },
    };
    const before = structuredClone(records);
    const playerIds = ['missing', ...Object.keys(records)];

    const result = markPendingRecordsAbsent(records, playerIds);

    assert.equal(result.updatedCount, 2);
    assert.deepEqual(result.records.missing, { status: 'falto' });
    assert.deepEqual(result.records.blank, { status: 'falto' });
    for (const id of ['attended', 'debtor', 'absent', 'other']) {
        assert.deepEqual(result.records[id], before[id]);
    }
    assert.deepEqual(records, before, 'does not mutate the input snapshot');
});

test('counts each listed player once and leaves unlisted records untouched', () => {
    const records = { listed: { status: '' }, unlisted: { status: '' } };
    const result = markPendingRecordsAbsent(records, ['listed', 'listed']);

    assert.equal(result.updatedCount, 1);
    assert.deepEqual(result.records.unlisted, records.unlisted);
    assert.deepEqual(getPendingAttendancePlayerIds(records, ['listed', 'listed']), ['listed']);
});

test('running the action again does not change completed records', () => {
    const first = markPendingRecordsAbsent({}, ['one', 'two']);
    const second = markPendingRecordsAbsent(first.records, ['one', 'two']);

    assert.equal(second.updatedCount, 0);
    assert.deepEqual(second.records, first.records);
});

test('rechecking a fresh snapshot preserves a player marked present by another editor', () => {
    const playerIds = ['one', 'two'];
    const original = { one: { status: '' }, two: { status: '' } };
    assert.equal(getPendingAttendancePlayerIds(original, playerIds).length, 2);
    const latest = { ...original, one: { status: 'asistio', paymentStatus: 'debe', debtAmount: '75' } };

    const result = markPendingRecordsAbsent(latest, playerIds);

    assert.equal(result.updatedCount, 1);
    assert.deepEqual(result.records.one, latest.one);
    assert.deepEqual(result.records.two, { status: 'falto' });
});

test('an empty roster makes no changes', () => {
    const records = { one: { status: '' } };
    const result = markPendingRecordsAbsent(records, []);

    assert.equal(result.updatedCount, 0);
    assert.deepEqual(result.records, records);
});

test('bulk actions resolve old player IDs so an attendance under a linked account is not overwritten', () => {
    const players = [{ id: 'roster-id', userId: 'account-id', aliasIds: ['account-id'] }, { id: 'pending-id' }];
    const records = { 'roster-id': { status: '' }, 'account-id': { status: 'asistio', paymentStatus: 'debe', debtAmount: '50' } };
    const result = markPendingRecordsAbsent(records, players);
    assert.equal(result.updatedCount, 1);
    assert.deepEqual(result.records['account-id'], records['account-id']);
    assert.deepEqual(result.records['roster-id'], records['roster-id']);
    assert.deepEqual(result.records['pending-id'], { status: 'falto' });
});

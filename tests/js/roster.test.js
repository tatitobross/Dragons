import test from 'node:test';
import assert from 'node:assert/strict';
import { getRosterPlayerIds, isManualRosterPlayer, listManualRosterPlayers, resolveRosterAttendanceRecord } from '../../resources/js/roster.js';

test('account-created entries are excluded even when a page account already exists', () => {
    const roster = [
        { id: 'danexi-account', userId: 'danexi-account', name: 'Danexi' },
        { id: 'another-account', source: 'account', name: 'Otra cuenta' },
    ];
    const before = structuredClone(roster);
    assert.deepEqual(listManualRosterPlayers(roster), []);
    assert.deepEqual(roster, before, 'hides automatic records without deleting them');
});

test('manual coach entries do not require an account and legacy entries remain visible', () => {
    const roster = [
        { id: 'old-manual', name: 'Carlos' },
        { id: 'new-manual', name: 'Ana', source: 'manual', createdBy: 'coach' },
        { id: 'linked-manual', userId: 'account', aliasIds: ['account'], name: 'Bea' },
    ];
    assert.deepEqual(listManualRosterPlayers(roster).map(player => player.name), ['Ana', 'Bea', 'Carlos']);
    assert.equal(isManualRosterPlayer({ id: 'account', userId: 'account', source: 'manual' }), true);
});

test('archived or previously merged entries are never shown as active players', () => {
    assert.equal(isManualRosterPlayer({ id: 'old', source: 'manual', archived: true }), false);
    assert.equal(isManualRosterPlayer({ id: 'old', source: 'manual', mergedInto: 'new' }), false);
    assert.equal(isManualRosterPlayer(null), false);
});

test('account name changes have no effect on the manually maintained roster', () => {
    const roster = [{ id: 'coach-entry', name: 'Nombre elegido por entrenador', source: 'manual' }];
    const before = structuredClone(roster);
    listManualRosterPlayers(roster);
    assert.deepEqual(roster, before);
});

test('attendance resolver preserves completed historical alias records over empty coach records', () => {
    const player = { id: 'canonical', userId: 'account', aliasIds: ['legacy', 'account'] };
    assert.deepEqual(getRosterPlayerIds(player), ['canonical', 'legacy', 'account']);
    const result = resolveRosterAttendanceRecord({ canonical: { status: '' }, account: { status: 'asistio', paymentStatus: 'debe' } }, player);
    assert.equal(result.playerId, 'account');
    assert.equal(result.record.status, 'asistio');
    const bothComplete = resolveRosterAttendanceRecord({ canonical: { status: 'falto' }, account: { status: 'asistio' } }, player);
    assert.equal(bothComplete.playerId, 'canonical');
    assert.equal(bothComplete.record.status, 'falto');
});

test('without history a coach-added player is pending under their independent roster ID', () => {
    assert.deepEqual(resolveRosterAttendanceRecord({}, { id: 'coach-entry', source: 'manual' }), { playerId: 'coach-entry', record: {} });
});

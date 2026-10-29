import test from 'node:test';
import assert from 'node:assert/strict';
import { personName } from '../../resources/js/person-name.js';
import { attendancePlayersForSession } from '../../resources/js/roster.js';

test('edit and remove icons precede the player name only for administrators', () => {
    const admin = personName({ name: 'Ana' }, { id: 'player', admin: true });
    assert.ok(admin.indexOf('data-person-action="edit"') < admin.indexOf('<strong>Ana</strong>'));
    assert.ok(admin.indexOf('data-person-action="remove"') < admin.indexOf('<strong>Ana</strong>'));
    assert.doesNotMatch(personName({ name: 'Ana' }), /<button|data-person-action/);
    assert.doesNotMatch(personName({ name: '<script>bad</script>' }, { id: '"><img>', admin: true }), /<script>|<img>/);
});

test('retired players remain in earlier lists and disappear from current and future dates', () => {
    const people = [{ id: 'ana', attendanceExcludedFrom: '2026-10-25' }, { id: 'luis' }];
    assert.deepEqual(attendancePlayersForSession({ date: '2026-10-24' }, people).map(person => person.id), ['ana', 'luis']);
    for (const date of ['2026-10-25', '2026-10-30', '2027-01-01']) {
        assert.deepEqual(attendancePlayersForSession({ date }, people).map(person => person.id), ['luis']);
    }
});

test('an explicit list exclusion covers historical alias IDs and survives date corrections', () => {
    const people = [{ id: 'roster', aliasIds: ['legacy'] }, { id: 'other' }];
    assert.deepEqual(attendancePlayersForSession({ date: '2026-01-01', excludedPlayerIds: ['legacy'] }, people).map(person => person.id), ['other']);
    assert.deepEqual(attendancePlayersForSession({ excludedPlayerIds: ['legacy'] }, ['legacy', 'other']), ['other']);
});

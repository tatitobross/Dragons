import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMemberSections } from '../../resources/js/member-content.js';

test('denied attendance preparation and gallery reads do not hide the registered player Danexi', async () => {
    const permissionDenied = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    const view = { players: null };
    const errors = [];
    const preparation = Promise.reject(permissionDenied).catch(() => {});

    const results = await loadMemberSections({
        users: async () => [{ id: 'danexi-account', name: 'Danexi', role: 'player' }],
        club: async () => { throw permissionDenied; },
        attendance: async () => { await preparation; throw permissionDenied; },
        roster: async () => { await preparation; return [{ id: 'danexi-roster', name: 'Danexi Perez' }]; },
    }, {
        onSection(section, value) {
            if (section === 'users') view.players = value.filter(user => user.role === 'player');
            if (section === 'roster') view.roster = value;
        },
        onError: section => { errors.push(section); },
    });

    assert.equal(view.players[0].name, 'Danexi');
    assert.equal(view.roster[0].name, 'Danexi Perez');
    assert.deepEqual(errors.sort(), ['attendance', 'club']);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);
});

test('players appear without waiting for a slow unavailable collection', async () => {
    let releaseSlowRead;
    let playerRendered;
    const visiblePlayer = new Promise(resolve => { playerRendered = resolve; });
    const slowRead = new Promise((_resolve, reject) => { releaseSlowRead = reject; });
    const finished = loadMemberSections({
        club: () => slowRead,
        users: async () => [{ name: 'Danexi' }],
    }, {
        onSection(section, value) { if (section === 'users') playerRendered(value); },
    });

    assert.equal((await visiblePlayer)[0].name, 'Danexi');
    releaseSlowRead(new Error('Unavailable'));
    const results = await finished;
    assert.equal(results[0].status, 'rejected');
    assert.equal(results[1].status, 'fulfilled');
});

test('late results and errors from a previous session do not update the page', async () => {
    let finishRead;
    let current = true;
    const rendered = [];
    const errors = [];
    const read = new Promise(resolve => { finishRead = resolve; });
    const finished = loadMemberSections({ users: () => read }, {
        isCurrent: () => current,
        onSection: section => { rendered.push(section); },
        onError: section => { errors.push(section); },
    });

    current = false;
    finishRead([{ name: 'Danexi' }]);
    await finished;

    assert.deepEqual(rendered, []);
    assert.deepEqual(errors, []);
});

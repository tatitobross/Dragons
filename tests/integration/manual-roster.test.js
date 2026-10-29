import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

const db = {};
let deliverSnapshot;
const subscribedCollections = [];
let unsubscribed = false;

mock.module(new URL('../../resources/js/firebase.js', import.meta.url).href, { exports: { db } });
mock.module('firebase/firestore', {
    exports: {
        collection(instance, name) { assert.equal(instance, db); subscribedCollections.push(name); return name; },
        onSnapshot(reference, callback) {
            assert.equal(reference, 'rosterPlayers');
            deliverSnapshot = players => callback({ docs: players.map(({ id, ...values }) => ({ id, data: () => values })) });
            return () => { unsubscribed = true; };
        },
    },
});

const { watchRosterPlayers } = await import('../../resources/js/roster-firebase.js');

test('attendance subscribes only to the coach roster and never to website accounts', () => {
    const stop = watchRosterPlayers(() => {});
    assert.deepEqual(subscribedCollections, ['rosterPlayers']);
    stop();
    assert.equal(unsubscribed, true);
});

test('previous automatic accounts are excluded while coach-added athletes remain', () => {
    let visiblePlayers;
    watchRosterPlayers(players => { visiblePlayers = players; });
    deliverSnapshot([
        { id: 'danexi-account', userId: 'danexi-account', name: 'Danexi' },
        { id: 'explicit-account', source: 'account', name: 'Cuenta de acceso' },
        { id: 'coach-added', name: 'Danexi Perez', source: 'manual' },
        { id: 'legacy-manual', name: 'Cesar Luis' },
    ]);
    assert.deepEqual(visiblePlayers.map(player => player.name), ['Cesar Luis', 'Danexi Perez']);
});

test('a manually added athlete requires no login account and retired athletes stay off the list', () => {
    let visiblePlayers;
    watchRosterPlayers(players => { visiblePlayers = players; });
    deliverSnapshot([
        { id: 'athlete', name: 'Atleta sin cuenta', source: 'manual' },
        { id: 'retired', name: 'Atleta retirado', source: 'manual', archived: true },
        { id: 'merged', name: 'Ficha anterior', mergedInto: 'athlete' },
    ]);
    assert.deepEqual(visiblePlayers.map(player => player.id), ['athlete']);
});

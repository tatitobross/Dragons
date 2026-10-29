import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

const auth = { currentUser: { uid: 'coach' } };
const db = {};
let documents;
let versions;
let attempts;
let commitError;

function seed(path, value) {
    documents.set(path, structuredClone(value));
    versions.set(path, (versions.get(path) || 0) + 1);
}

// Model optimistic transactions: snapshots are versioned, writes are staged,
// and a competing commit causes the actual module callback to run again.
async function runTransaction(database, callback) {
    assert.equal(database, db);
    for (let retry = 0; retry < 5; retry += 1) {
        attempts += 1;
        const reads = new Map();
        const writes = [];
        const result = await callback({
            async get(path) {
                const data = documents.get(path);
                const snapshot = data === undefined ? undefined : structuredClone(data);
                reads.set(path, versions.get(path) || 0);
                return {
                    exists: () => snapshot !== undefined,
                    data: () => structuredClone(snapshot),
                };
            },
            set(path, value, options) {
                writes.push({ path, value: structuredClone(value), merge: Boolean(options?.merge) });
            },
        });
        if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) continue;
        if (commitError) throw commitError;
        for (const write of writes) {
            seed(write.path, write.merge ? { ...documents.get(write.path), ...write.value } : write.value);
        }
        return result;
    }
    throw new Error('Transaction contention exceeded test retry limit.');
}

mock.module('firebase/firestore', {
    exports: {
        doc: (_database, ...parts) => parts.join('/'),
        collection: (_database, name) => name,
        runTransaction,
        getDocs: async () => ({ docs: [] }),
        limit: count => ({ limit: count }),
        orderBy: (field, direction) => ({ field, direction }),
        query: (...args) => args,
        onSnapshot: () => () => {},
    },
});
mock.module(new URL('../../resources/js/firebase.js', import.meta.url).href, {
    exports: { auth, db },
});

const { recordSavingsMovement } = await import('../../resources/js/savings-firebase.js');

beforeEach(() => {
    documents = new Map();
    versions = new Map();
    attempts = 0;
    commitError = null;
    auth.currentUser = { uid: 'coach' };
    seed('savings/current', { amount: 1000, initialSource: 'existing team balance' });
});

const income = (operationId, amount, note = '') => ({ type: 'income', amount, note, operationId });
const history = () => [...documents.entries()].filter(([path]) => path.startsWith('savingsMovements/'));

test('records an income against the existing balance and saves its audit entry', async () => {
    const result = await recordSavingsMovement(income('income-operation-1', '250.50', '  Aportes del entreno  '));

    assert.deepEqual(result, { amount: 1250.5, alreadyApplied: false });
    assert.equal(documents.get('savings/current').amount, 1250.5);
    assert.equal(documents.get('savings/current').initialSource, 'existing team balance');
    assert.deepEqual(history().map(([path]) => path), ['savingsMovements/income-operation-1']);
    const movement = documents.get('savingsMovements/income-operation-1');
    assert.equal(movement.type, 'income');
    assert.equal(movement.amount, 250.5);
    assert.equal(movement.note, 'Aportes del entreno');
    assert.equal(movement.previousBalance, 1000);
    assert.equal(movement.balanceAfter, 1250.5);
    assert.equal(movement.createdBy, 'coach');
    assert.equal(Number.isNaN(Date.parse(movement.createdAt)), false);
});

test('records a purchase as an expense and preserves the remaining balance', async () => {
    const result = await recordSavingsMovement({ type: 'expense', amount: '325.25', note: 'Balones', operationId: 'expense-operation-1' });

    assert.equal(result.amount, 674.75);
    const movement = documents.get('savingsMovements/expense-operation-1');
    assert.equal(movement.type, 'expense');
    assert.equal(movement.amount, 325.25);
    assert.equal(movement.previousBalance, 1000);
    assert.equal(movement.balanceAfter, 674.75);
});

test('reusing an operation ID returns the latest balance without applying it again', async () => {
    const original = income('repeated-operation-1', 100);
    await recordSavingsMovement(original);
    await recordSavingsMovement(income('another-operation-1', 200));
    const savedOriginal = structuredClone(documents.get('savingsMovements/repeated-operation-1'));

    const result = await recordSavingsMovement(original);

    assert.deepEqual(result, { amount: 1300, alreadyApplied: true });
    assert.equal(documents.get('savings/current').amount, 1300);
    assert.equal(history().length, 2);
    assert.deepEqual(documents.get('savingsMovements/repeated-operation-1'), savedOriginal);
});

test('simultaneous contributions retry against the latest snapshot instead of losing an addition', async () => {
    await Promise.all([
        recordSavingsMovement(income('concurrent-income-1', '100.10')),
        recordSavingsMovement(income('concurrent-income-2', '200.20')),
    ]);

    assert.equal(documents.get('savings/current').amount, 1300.3);
    assert.equal(history().length, 2);
    assert.ok(attempts >= 3, 'the competing callback actually ran again after a version conflict');
    const audit = history().map(([, entry]) => entry).sort((a, b) => a.previousBalance - b.previousBalance);
    assert.equal(audit[0].previousBalance, 1000);
    assert.equal(audit[1].previousBalance, audit[0].balanceAfter);
    assert.equal(audit[1].balanceAfter, 1300.3);
});

test('simultaneous submissions of the same operation apply the contribution exactly once', async () => {
    const operation = income('concurrent-duplicate-1', 50);
    const results = await Promise.all([recordSavingsMovement(operation), recordSavingsMovement(operation)]);

    assert.equal(documents.get('savings/current').amount, 1050);
    assert.equal(history().length, 1);
    assert.deepEqual(results.map(result => result.alreadyApplied).sort(), [false, true]);
});

test('concurrent expenses cannot overdraw the latest balance', async () => {
    const results = await Promise.allSettled([
        recordSavingsMovement({ type: 'expense', amount: 700, operationId: 'concurrent-expense-1' }),
        recordSavingsMovement({ type: 'expense', amount: 700, operationId: 'concurrent-expense-2' }),
    ]);

    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.match(results.find(result => result.status === 'rejected').reason.message, /mayor que el saldo/);
    assert.equal(documents.get('savings/current').amount, 300);
    assert.equal(history().length, 1);
});

test('a failed commit writes neither balance nor audit entry, and the same operation can be retried', async () => {
    const initialBalance = structuredClone(documents.get('savings/current'));
    const operation = income('retry-after-failure-1', 150);
    commitError = new Error('network unavailable');

    await assert.rejects(recordSavingsMovement(operation), /network unavailable/);
    assert.deepEqual(documents.get('savings/current'), initialBalance);
    assert.equal(history().length, 0);

    commitError = null;
    const result = await recordSavingsMovement(operation);
    assert.deepEqual(result, { amount: 1150, alreadyApplied: false });
    assert.equal(history().length, 1);
});

test('an invalid or unaffordable movement makes no writes', async () => {
    const initialBalance = structuredClone(documents.get('savings/current'));
    await assert.rejects(recordSavingsMovement({ type: 'expense', amount: 1001, operationId: 'overdraw-operation-1' }), /mayor que el saldo/);
    await assert.rejects(recordSavingsMovement(income('bad-amount-operation', 0)), /mayor que cero/);
    assert.deepEqual(documents.get('savings/current'), initialBalance);
    assert.equal(history().length, 0);
});

test('rejects a reused operation ID with different data instead of silently accepting a different movement', async () => {
    await recordSavingsMovement(income('conflicting-operation', 100));
    await assert.rejects(recordSavingsMovement(income('conflicting-operation', 200)), /otros datos/);
    assert.equal(documents.get('savings/current').amount, 1100);
    assert.equal(history().length, 1);
});

test('requires a signed-in user and a valid operation ID before starting a transaction', async () => {
    auth.currentUser = null;
    await assert.rejects(recordSavingsMovement(income('signed-out-operation', 100)), /Inicia sesión/);
    auth.currentUser = { uid: 'coach' };
    await assert.rejects(recordSavingsMovement(income('bad/id', 100)), /identificar/);
    assert.equal(attempts, 0);
    assert.equal(history().length, 0);
});

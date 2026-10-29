import test from 'node:test';
import assert from 'node:assert/strict';
import { applySavingsMovement, moneyToCents } from '../../resources/js/savings.js';

test('adds an income to the existing balance instead of replacing it', () => {
    assert.deepEqual(applySavingsMovement(1000, { type: 'income', amount: '250.50' }), {
        amount: 1250.5,
        previousAmount: 1000,
        movementAmount: 250.5,
    });
});

test('subtracts a team expense and allows spending the entire balance', () => {
    assert.equal(applySavingsMovement(1000, { type: 'expense', amount: 300 }).amount, 700);
    assert.equal(applySavingsMovement('700.25', { type: 'expense', amount: '700.25' }).amount, 0);
});

test('calculates with cents so decimal contributions and expenses stay exact', () => {
    const first = applySavingsMovement(0.1, { type: 'income', amount: 0.2 });
    assert.equal(first.amount, 0.3);
    const second = applySavingsMovement(first.amount, { type: 'expense', amount: 0.1 });
    assert.equal(second.amount, 0.2);
});

test('rejects a withdrawal that would overdraw the balance', () => {
    assert.throws(() => applySavingsMovement(1000, { type: 'expense', amount: '1000.01' }), /mayor que el saldo/);
});

test('rejects zero and negative movement amounts', () => {
    for (const amount of [0, '0.00', '-5', -100]) {
        assert.throws(() => applySavingsMovement(1000, { type: 'income', amount }));
        assert.throws(() => applySavingsMovement(1000, { type: 'expense', amount }));
    }
});

test('rejects missing, nonnumeric, fractional-cent, and non-finite amounts', () => {
    for (const amount of ['', ' ', null, undefined, '5.555', '100,50', 'ten', NaN, Infinity]) {
        assert.throws(() => applySavingsMovement(1000, { type: 'income', amount }));
    }
});

test('supports a leading decimal point and ignores surrounding spaces', () => {
    assert.equal(moneyToCents('.50'), 50);
    assert.equal(moneyToCents(' 12.30 '), 1230);
});

test('rejects unsupported movement types', () => {
    assert.throws(() => applySavingsMovement(1000, { type: 'replace', amount: 50 }), /tipo|Selecciona/);
});

test('rejects invalid existing balances instead of silently resetting them', () => {
    for (const balance of [undefined, 'not a balance', -1, NaN]) {
        assert.throws(() => applySavingsMovement(balance, { type: 'income', amount: 50 }));
    }
});

test('rejects amounts and resulting balances outside the safe cents range', () => {
    assert.throws(() => moneyToCents('90071992547410'), /demasiado grande/);
    assert.throws(() => applySavingsMovement('90071992547409.90', { type: 'income', amount: '.10' }), /demasiado grande/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { publicAttendanceSession } from '../../resources/js/attendance-privacy.js';

test('athletes get every attendance and payment status but never debt amounts or extra private fields', () => {
    const source = {
        date: '2026-10-28', createdAt: '2026-10-28T12:00:00.000Z', internalNote: 'private',
        records: {
            one: { status: 'asistio', paymentStatus: 'debe', debtAmount: '150', email: 'private@example.com' },
            two: { status: 'asistio', paymentStatus: 'pago', debtAmount: '' },
            three: { status: 'falto', debtAmount: '25' },
            four: { status: '' },
        },
    };
    const summary = publicAttendanceSession(source);
    assert.deepEqual(summary, {
        date: source.date, createdAt: source.createdAt,
        records: {
            one: { status: 'asistio', paymentStatus: 'debe' },
            two: { status: 'asistio', paymentStatus: 'pago' },
            three: { status: 'falto' },
            four: { status: '' },
        },
    });
    assert.equal(source.records.one.debtAmount, '150');
});

test('summaries handle empty sessions and do not copy unexpected status values', () => {
    assert.deepEqual(publicAttendanceSession({}), { date: '', createdAt: '', records: {} });
    assert.deepEqual(publicAttendanceSession({ records: {
        one: { status: 'private text', paymentStatus: 'private text' },
        two: { status: 'asistio', paymentStatus: 'private text' },
        three: null,
    } }).records, { one: { status: '' }, two: { status: 'asistio', paymentStatus: '' }, three: { status: '' } });
});

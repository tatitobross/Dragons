import test from 'node:test';
import assert from 'node:assert/strict';
import { activityDetails, activityParticipant, activityTotals } from '../../resources/js/activities.js';
import { activityView } from '../../resources/js/activities-view.js';

test('activities accept a name with an optional real calendar date', () => {
    assert.deepEqual(activityDetails({ title: ' Rifa ' }), { title: 'Rifa', date: '' });
    assert.deepEqual(activityDetails({ title: 'Cena', date: '2028-02-29' }), { title: 'Cena', date: '2028-02-29' });
    for (const date of ['2026-02-29', '2026-13-01', null, 'ayer']) assert.throws(() => activityDetails({ title: 'Rifa', date }), /fecha/);
    for (const title of ['', '   ', 'a'.repeat(121)]) assert.throws(() => activityDetails({ title }), /nombre/);
});
test('delivery names and optional ticket details are validated', () => {
    assert.deepEqual(activityParticipant({ name: ' Ana ', detail: ' Boletos 1–10 ' }), { name: 'Ana', detail: 'Boletos 1–10' });
    assert.throws(() => activityParticipant({ name: '' }), /nombre/);
    assert.throws(() => activityParticipant({ name: 'Ana', detail: 'x'.repeat(161) }), /detalle/);
});
test('pending and paid counts match only the people added to this activity', () => {
    assert.deepEqual(activityTotals(), { total: 0, paid: 0, pending: 0 });
    assert.deepEqual(activityTotals({ a: { status: 'pending' }, b: { status: 'paid' }, c: {} }), { total: 3, paid: 1, pending: 2 });
});
test('athletes see the delivery statuses without edit controls or payment selects', () => {
    const markup = activityView({ title: 'Rifa', participants: { a: { name: 'Ana', status: 'pending' }, b: { name: 'Luis', status: 'paid' } } });
    assert.match(markup, /Ana/); assert.match(markup, /Luis/);
    assert.match(markup, /Pendiente/); assert.match(markup, /Pagado/);
    assert.doesNotMatch(markup, /<select|data-activity-payment|data-activity-action="(?:edit|delete|add-person)/);
});
test('the coach gets editor icons, manual add and per-person payment controls; names are escaped', () => {
    const markup = activityView({ title: '<img src=x onerror=alert(1)>', participants: { person: { name: '<script>bad</script>', detail: 'Boletos 1–10', status: 'pending' } } }, { admin: true });
    assert.match(markup, /data-activity-payment/); assert.match(markup, /data-activity-action="add-person"/);
    assert.match(markup, /data-activity-action="edit-person"/); assert.match(markup, /data-activity-action="delete-person"/);
    assert.match(markup, /Boletos 1–10/); assert.doesNotMatch(markup, /<script>|<img/);
});

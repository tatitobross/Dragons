import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

let subscriptions, payments, completePayment;
mock.module(new URL('../../resources/js/activities-firebase.js', import.meta.url).href, { exports: {
    watchActivities(callback, onError) {
        const subscription = { callback, onError, stopped: false }; subscriptions.push(subscription);
        return () => { subscription.stopped = true; };
    },
    setActivityPayment: (...args) => { payments.push(args); return new Promise(resolve => { completePayment = resolve; }); },
    createActivity: async () => 'new', updateActivity: async () => {}, deleteActivity: async () => {},
    addActivityParticipant: async () => {}, updateActivityParticipant: async () => {}, removeActivityParticipant: async () => {},
} });
const { createActivityControl } = await import('../../resources/js/activities-control.js');

function setup() {
    const events = {}, messages = [];
    const list = { innerHTML: '' };
    const classes = new Set();
    const modal = { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
    const form = { addEventListener() {} };
    const root = {
        querySelector(selector) { return ({ '[data-activity-list]': list, '[data-activity-modal]': modal, '[data-activity-editor]': form, '#activity-create-form': form })[selector] || null; },
        addEventListener(name, handler) { events[name] = handler; },
    };
    return { controller: createActivityControl(root, { toast: message => messages.push(message) }), events, list, messages, classes };
}
const activity = { id: 'raffle', title: 'Rifa', participants: { person: { name: 'Ana', status: 'pending' } } };
beforeEach(() => { subscriptions = []; payments = []; completePayment = null; });

test('logout removes visible data, unsubscribes and ignores late snapshots', () => {
    const { controller, list } = setup();
    controller.setUser({ admin: true }); subscriptions[0].callback([activity]);
    assert.match(list.innerHTML, /Ana/);
    controller.setUser(null);
    assert.equal(subscriptions[0].stopped, true); assert.equal(list.innerHTML, '');
    subscriptions[0].callback([activity]); assert.equal(list.innerHTML, '');
});
test('an older administrator subscription cannot expose editors after switching to an athlete', () => {
    const { controller, list } = setup();
    controller.setUser({ admin: true }); controller.setUser({ admin: false });
    subscriptions[1].callback([activity]);
    subscriptions[0].callback([{ ...activity, title: 'Stale snapshot' }]);
    assert.match(list.innerHTML, /Rifa/); assert.doesNotMatch(list.innerHTML, /Stale snapshot|data-activity-payment|data-activity-action="edit"/);
});
test('payment changes target the selected activity/person and ignore duplicate changes while saving', async () => {
    const { controller, events, messages } = setup();
    controller.setUser({ admin: true }); subscriptions[0].callback([activity]);
    const select = { dataset: { person: 'person' }, value: 'paid', disabled: false };
    const event = { target: { closest: () => select } };
    const pending = events.change(event);
    assert.equal(select.disabled, true);
    await events.change(event); assert.equal(payments.length, 1);
    assert.deepEqual(payments[0], ['raffle', 'person', 'paid']);
    completePayment(); await pending;
    assert.equal(select.disabled, false); assert.deepEqual(messages, ['Pago registrado.']);
});
test('athletes cannot save payment changes even if a forged control triggers the handler', async () => {
    const { controller, events } = setup();
    controller.setUser({ admin: false }); subscriptions[0].callback([activity]);
    await events.change({ target: { closest: () => ({ dataset: { person: 'person' }, value: 'paid' }) } });
    assert.equal(payments.length, 0);
});

import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

let requests = [];
let requestImplementation = async () => {};
let fixtureNumber = 0;

mock.module(new URL('../../resources/js/password-reset.js', import.meta.url).href, {
    exports: {
        async requestPasswordReset(email) {
            requests.push(email);
            return requestImplementation(email);
        },
    },
});

const { bindPasswordResetForm } = await import('../../resources/js/password-reset-form.js');

function createFixture() {
    const listeners = new Map();
    const attributes = new Map();
    const field = { value: `member-${++fixtureNumber}@example.com`, disabled: false };
    const button = { textContent: 'Enviar enlace al correo →', disabled: false };
    const feedback = {
        hidden: true, dataset: {}, textContent: '', attributes: new Map(),
        setAttribute(name, value) { this.attributes.set(name, value); },
    };
    const form = {
        elements: { email: field }, dataset: {}, valid: true,
        reportValidity() { return this.valid; },
        querySelector(selector) { return selector === '[type="submit"]' ? button : null; },
        setAttribute(name, value) { attributes.set(name, value); },
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
        },
    };
    return {
        form, field, button, feedback, attributes, listeners,
        submit() { return Promise.all((listeners.get('submit') || []).map(listener => listener({ preventDefault() {}, currentTarget: form }))); },
    };
}

beforeEach(() => {
    requests = [];
    requestImplementation = async () => {};
});

test('a static recovery form sends the trimmed address, keeps it visible and confirms the next step', async () => {
    const view = createFixture();
    view.field.value = `  ${view.field.value}  `;
    bindPasswordResetForm(view.form, view.feedback);

    await view.submit();

    assert.deepEqual(requests, [view.field.value]);
    assert.equal(view.field.value.includes(' '), false);
    assert.equal(view.feedback.hidden, false);
    assert.match(view.feedback.textContent, /correo está registrado.*enlace.*spam/);
    assert.equal(view.feedback.attributes.get('role'), 'status');
    assert.equal(view.button.disabled, false);
    assert.equal(view.field.disabled, false);
    assert.equal(view.attributes.get('aria-busy'), 'false');
});

test('a pending request disables controls and ignores a second submit', async () => {
    const view = createFixture();
    let finish;
    requestImplementation = () => new Promise(resolve => { finish = resolve; });
    bindPasswordResetForm(view.form, view.feedback);

    const firstSubmission = view.submit();
    await view.submit();

    assert.equal(requests.length, 1);
    assert.equal(view.button.disabled, true);
    assert.equal(view.field.disabled, true);
    assert.equal(view.button.textContent, 'Enviando…');
    assert.equal(view.attributes.get('aria-busy'), 'true');
    finish();
    await firstSubmission;
    assert.equal(view.button.disabled, false);
    assert.equal(view.field.disabled, false);
});

test('a failed request shows the error and restores controls so the user can retry', async () => {
    const view = createFixture();
    requestImplementation = async () => { throw new Error('Revisa tu conexión.'); };
    bindPasswordResetForm(view.form, view.feedback);

    await view.submit();

    assert.equal(view.feedback.textContent, 'Revisa tu conexión.');
    assert.equal(view.feedback.dataset.state, 'error');
    assert.equal(view.feedback.attributes.get('role'), 'alert');
    assert.equal(view.button.disabled, false);
    assert.equal(view.field.disabled, false);
    assert.equal(view.button.textContent, 'Enviar enlace al correo →');
    requestImplementation = async () => {};
    await view.submit();
    assert.equal(requests.length, 2, 'a failed attempt does not start the success cooldown');
});

test('native form validation rejects an invalid address before making a request', async () => {
    const view = createFixture();
    view.form.valid = false;
    view.field.value = 'invalid';
    bindPasswordResetForm(view.form, view.feedback);

    await view.submit();

    assert.equal(requests.length, 0);
    assert.equal(view.button.disabled, false);
    assert.equal(view.feedback.hidden, true);
});

test('a successful request cannot be resent to the same address immediately', async () => {
    const view = createFixture();
    bindPasswordResetForm(view.form, view.feedback);
    await view.submit();
    view.field.value = view.field.value.toUpperCase();

    await view.submit();

    assert.equal(requests.length, 1);
    assert.match(view.feedback.textContent, /Espera un minuto/);
    assert.equal(view.button.disabled, false);
});

test('correcting the address is allowed even during the previous address cooldown', async () => {
    const view = createFixture();
    bindPasswordResetForm(view.form, view.feedback);
    await view.submit();
    const previousAddress = view.field.value;
    view.field.value = `corrected-${previousAddress}`;

    await view.submit();

    assert.deepEqual(requests, [previousAddress, view.field.value]);
});

test('binding twice does not attach duplicate submit handlers and missing elements are harmless', async () => {
    const view = createFixture();
    bindPasswordResetForm(null, null);
    bindPasswordResetForm(view.form, null);
    bindPasswordResetForm(view.form, view.feedback);
    bindPasswordResetForm(view.form, view.feedback);

    assert.equal(view.listeners.get('submit').length, 1);
    await view.submit();
    assert.equal(requests.length, 1);
});

import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

const auth = { currentUser: null, languageCode: null };
let requests = [];
let sendError = null;

const firebaseModuleUrl = new URL('../../resources/js/firebase.js', import.meta.url).href;
const firebaseMock = mock.module(firebaseModuleUrl, { exports: { auth } });
mock.module('firebase/auth', {
    exports: {
        async sendPasswordResetEmail(instance, email) {
            requests.push({ instance, email });
            if (sendError) throw sendError;
        },
    },
});

const { requestPasswordReset } = await import('../../resources/js/password-reset.js');

beforeEach(() => {
    requests = [];
    sendError = null;
    auth.currentUser = null;
    auth.languageCode = null;
});

test('requests the reset for the trimmed email in Spanish without requiring a signed-in session', async () => {
    await requestPasswordReset('  admin@example.com  ');

    assert.equal(requests.length, 1);
    assert.equal(requests[0].instance, auth);
    assert.equal(requests[0].email, 'admin@example.com');
    assert.equal(auth.languageCode, 'es');
    assert.equal(auth.currentUser, null);
});

test('rejects blank or malformed emails before sending any request', async () => {
    for (const email of ['', '   ', null, undefined, 123, 'sin-correo', 'a@@example.com', 'a b@example.com']) {
        await assert.rejects(() => requestPasswordReset(email), /correo|válid|formato/i);
    }
    assert.equal(requests.length, 0);
});

test('reset requests preserve the current account and its administrator role', async () => {
    const user = Object.freeze({ uid: 'coach', role: 'admin', email: 'admin@example.com' });
    auth.currentUser = user;

    await requestPasswordReset('admin@example.com');

    assert.equal(auth.currentUser, user);
    assert.equal(user.role, 'admin');
    assert.equal(requests.length, 1);
});

test('an unregistered email has the same successful outcome as a registered email', async () => {
    sendError = { code: 'auth/user-not-found', message: 'Private account lookup details' };
    await assert.doesNotReject(() => requestPasswordReset('missing@example.com'));
    assert.equal(requests.length, 1);
});

test('too many requests produces a useful Spanish retry message', async () => {
    sendError = { code: 'auth/too-many-requests', message: 'Internal quota details' };
    await assert.rejects(() => requestPasswordReset('admin@example.com'), /espera|intenta|solicitudes/i);
});

test('a network failure produces a useful Spanish connection message', async () => {
    sendError = { code: 'auth/network-request-failed', message: 'Internal request URL' };
    await assert.rejects(() => requestPasswordReset('admin@example.com'), /conexión|internet|red/i);
});

test('unexpected Firebase failures do not expose the original message', async () => {
    sendError = { code: 'auth/internal-error', message: 'SECRET INTERNAL ACCOUNT DETAIL' };
    await assert.rejects(() => requestPasswordReset('admin@example.com'), error => {
        assert.match(error.message, /enviar|recuper|intenta|restablec/i);
        assert.equal(error.message.includes(sendError.message), false);
        return true;
    });
});

test('recovery reports unavailable Firebase instead of trying to send with a missing auth instance', async () => {
    firebaseMock.restore();
    const unavailableMock = mock.module(firebaseModuleUrl, { exports: { auth: null } });
    try {
        const { requestPasswordReset: unavailableReset } = await import('../../resources/js/password-reset.js?unavailable');
        await assert.rejects(() => unavailableReset('admin@example.com'), /disponible|configura|habilitad/i);
        assert.equal(requests.length, 0);
    } finally {
        unavailableMock.restore();
    }
});

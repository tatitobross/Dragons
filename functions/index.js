import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp();
const db = getFirestore();

async function requireAdmin(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    const profile = await db.doc(`users/${request.auth.uid}`).get();
    if (!profile.exists || profile.data().role !== 'admin') throw new HttpsError('permission-denied', 'Solo el entrenador puede gestionar jugadores.');
}

export const createPlayer = onCall(async request => {
    await requireAdmin(request);
    const { name, email, phone, tempPassword } = request.data || {};
    if (!name || !email || !phone || !tempPassword) throw new HttpsError('invalid-argument', 'Nombre, correo, teléfono y contraseña temporal son obligatorios.');
    const user = await getAuth().createUser({ displayName: name, email, password: tempPassword, phoneNumber: phone, emailVerified: false });
    await db.doc(`users/${user.uid}`).set({ name, email, phone, role: 'player', createdAt: new Date().toISOString(), createdBy: request.auth.uid });
    return { uid: user.uid };
});

export const updatePlayer = onCall(async request => {
    await requireAdmin(request);
    const { uid, name, phone, password, disabled } = request.data || {};
    if (!uid) throw new HttpsError('invalid-argument', 'Falta el jugador.');
    const updates = {};
    if (name) updates.displayName = name;
    if (phone) updates.phoneNumber = phone;
    if (password) updates.password = password;
    if (typeof disabled === 'boolean') updates.disabled = disabled;
    await getAuth().updateUser(uid, updates);
    await db.doc(`users/${uid}`).set({ ...(name ? { name } : {}), ...(phone ? { phone } : {}) }, { merge: true });
    return { uid };
});

export const deletePlayer = onCall(async request => {
    await requireAdmin(request);
    const { uid } = request.data || {};
    if (!uid || uid === request.auth.uid) throw new HttpsError('invalid-argument', 'No puedes eliminar tu propia cuenta desde aquí.');
    await getAuth().deleteUser(uid);
    await db.doc(`users/${uid}`).delete();
    return { uid };
});

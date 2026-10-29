import { collection, deleteDoc, doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { activityDetails, activityParticipant } from './activities.js';

function requireUser() {
    if (!auth?.currentUser) throw new Error('Inicia sesión como administrador.');
    return auth.currentUser.uid;
}
function activityRef(id) {
    requireUser();
    if (typeof id !== 'string' || !id || id.includes('/')) throw new Error('La actividad no es válida.');
    return doc(db, 'activities', id);
}
export function watchActivities(callback, onError) {
    return onSnapshot(collection(db, 'activities'), snapshot => {
        callback(snapshot.docs.map(item => ({ ...item.data(), id: item.id })).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.id.localeCompare(b.id)));
    }, onError);
}
export async function createActivity(values) {
    const createdBy = requireUser();
    const details = activityDetails(values);
    const reference = doc(collection(db, 'activities'));
    await setDoc(reference, { ...details, participants: {}, createdBy, createdAt: new Date().toISOString() });
    return reference.id;
}
export async function updateActivity(id, values) {
    const reference = activityRef(id); const details = activityDetails(values);
    await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error('La actividad ya no existe.');
        transaction.update(reference, details);
    });
}
export async function deleteActivity(id) { await deleteDoc(activityRef(id)); }

async function changeParticipants(id, mutate) {
    const reference = activityRef(id);
    await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error('La actividad ya no existe.');
        const participants = { ...(snapshot.data().participants || {}) };
        mutate(participants);
        transaction.update(reference, { participants });
    });
}
function existingPerson(participants, personId) {
    if (typeof personId !== 'string' || !Object.hasOwn(participants, personId)) throw new Error('La persona ya no está en esta actividad.');
    return participants[personId];
}
export async function addActivityParticipant(id, values) {
    const person = activityParticipant(values);
    const personId = doc(collection(db, 'activities')).id;
    const createdAt = new Date().toISOString();
    await changeParticipants(id, participants => {
        if (Object.keys(participants).length >= 200) throw new Error('Esta lista admite hasta 200 personas. Crea otra actividad para continuar.');
        participants[personId] = { ...person, status: 'pending', createdAt };
    });
    return personId;
}
export async function updateActivityParticipant(id, personId, values) {
    const person = activityParticipant(values);
    await changeParticipants(id, participants => { participants[personId] = { ...existingPerson(participants, personId), ...person }; });
}
export async function setActivityPayment(id, personId, status) {
    if (!['pending', 'paid'].includes(status)) throw new Error('Selecciona Pendiente o Pagado.');
    const paidAt = status === 'paid' ? new Date().toISOString() : null;
    await changeParticipants(id, participants => { participants[personId] = { ...existingPerson(participants, personId), status, paidAt }; });
}
export async function removeActivityParticipant(id, personId) {
    await changeParticipants(id, participants => { existingPerson(participants, personId); delete participants[personId]; });
}

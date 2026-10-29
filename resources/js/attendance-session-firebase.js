import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { publicAttendanceSession } from './attendance-privacy.js';
import { attendanceSessionTitle } from './attendance.js';

function sessionReferences(sessionId) {
    if (!auth?.currentUser) throw new Error('Inicia sesión como administrador.');
    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.includes('/')) {
        throw new Error('La lista de asistencia no es válida.');
    }
    // Firestore rules authorize both writes exclusively for the administrator.
    return [doc(db, 'attendance', sessionId), doc(db, 'attendancePublic', sessionId)];
}

export async function updateAttendanceSessionDate(sessionId, date) {
    return updateAttendanceSessionDetails(sessionId, { date });
}

export async function updateAttendanceSessionDetails(sessionId, { date, title }) {
    const [privateRef, publicRef] = sessionReferences(sessionId);
    const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() < 1 || parsed.toISOString().slice(0, 10) !== date) {
        throw new Error('Selecciona una fecha válida.');
    }
    const changes = { date, ...(title !== undefined ? { title: attendanceSessionTitle(title) } : {}) };
    await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(privateRef);
        if (!snapshot.exists()) throw new Error('La lista de asistencia ya no existe.');
        const session = snapshot.data();
        transaction.update(privateRef, changes);
        transaction.set(publicRef, publicAttendanceSession({ ...session, ...changes }));
    });
}

export async function deleteAttendanceSession(sessionId) {
    const [privateRef, publicRef] = sessionReferences(sessionId);
    // Remove both copies atomically so an athlete cannot see a deleted list.
    await runTransaction(db, async transaction => {
        transaction.delete(privateRef);
        transaction.delete(publicRef);
    });
}

import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { publicAttendanceSession } from './attendance-privacy.js';
import { getRosterPlayerIds } from './roster.js';

export async function removePlayerFromAttendance(sessionId, playerId) {
    if (!auth?.currentUser) throw new Error('Inicia sesión como entrenador.');
    for (const id of [sessionId, playerId]) if (typeof id !== 'string' || !id || id.includes('/')) throw new Error('El jugador o la lista no son válidos.');
    const sessionRef = doc(db, 'attendance', sessionId);
    const playerRef = doc(db, 'rosterPlayers', playerId);
    await runTransaction(db, async transaction => {
        const [sessionSnapshot, playerSnapshot] = await Promise.all([transaction.get(sessionRef), transaction.get(playerRef)]);
        if (!sessionSnapshot.exists()) throw new Error('La lista ya no existe.');
        if (!playerSnapshot.exists()) throw new Error('El atleta ya no existe.');
        const session = sessionSnapshot.data(), player = playerSnapshot.data();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date || '')) throw new Error('Corrige la fecha del entreno antes de retirar al atleta.');
        const ids = getRosterPlayerIds({ ...player, id: playerId });
        const excludedPlayerIds = [...new Set([...(session.excludedPlayerIds || []), ...ids])];
        const attendanceExcludedFrom = player.attendanceExcludedFrom && player.attendanceExcludedFrom < session.date ? player.attendanceExcludedFrom : session.date;
        // Keep historical records and hide this athlete only from this date onward.
        transaction.update(playerRef, { attendanceExcludedFrom });
        transaction.update(sessionRef, { excludedPlayerIds });
        transaction.set(doc(db, 'attendancePublic', sessionId), publicAttendanceSession({ ...session, excludedPlayerIds }));
    });
}

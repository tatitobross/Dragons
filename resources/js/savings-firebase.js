import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { applySavingsMovement, moneyToCents } from './savings.js';

export async function recordSavingsMovement({ type, amount, note = '', operationId }) {
    const userId = auth?.currentUser?.uid;
    if (!userId) throw new Error('Inicia sesión como administrador para registrar movimientos.');
    if (typeof operationId !== 'string' || !/^[A-Za-z0-9_-]{10,128}$/.test(operationId)) {
        throw new Error('No se pudo identificar este movimiento. Vuelve a intentarlo.');
    }
    const cleanNote = String(note).trim();
    if (cleanNote.length > 240) throw new Error('El motivo puede tener un máximo de 240 caracteres.');
    const movementAmount = moneyToCents(amount) / 100;
    // Validate the movement before entering a retriable transaction.
    if (type !== 'income' && type !== 'expense') throw new Error('Selecciona el tipo de movimiento.');
    if (movementAmount <= 0) throw new Error('El monto debe ser mayor que cero.');

    const balanceRef = doc(db, 'savings', 'current');
    const movementRef = doc(db, 'savingsMovements', operationId);
    const createdAt = new Date().toISOString();
    return runTransaction(db, async transaction => {
        const [balanceSnapshot, movementSnapshot] = await Promise.all([
            transaction.get(balanceRef),
            transaction.get(movementRef),
        ]);
        const currentAmount = balanceSnapshot.exists() ? balanceSnapshot.data().amount : 0;
        if (movementSnapshot.exists()) {
            const saved = movementSnapshot.data();
            if (saved.type !== type || saved.amount !== movementAmount || saved.note !== cleanNote || saved.createdBy !== userId) {
                throw new Error('Este movimiento ya fue registrado con otros datos. Actualiza la página antes de registrar uno nuevo.');
            }
            return { amount: moneyToCents(currentAmount, 'saldo') / 100, alreadyApplied: true };
        }

        const result = applySavingsMovement(currentAmount, { type, amount: movementAmount });
        transaction.set(balanceRef, { amount: result.amount, updatedAt: createdAt }, { merge: true });
        transaction.set(movementRef, {
            type,
            amount: result.movementAmount,
            note: cleanNote,
            previousBalance: result.previousAmount,
            balanceAfter: result.amount,
            createdAt,
            createdBy: userId,
        });
        return { amount: result.amount, alreadyApplied: false };
    });
}

export function watchSavings(callback, onError = () => {}) {
    return onSnapshot(doc(db, 'savings', 'current'), snapshot => {
        callback(snapshot.exists() ? snapshot.data() : { amount: 0 });
    }, onError);
}

export async function loadSavingsMovements() {
    const snapshot = await getDocs(query(collection(db, 'savingsMovements'), orderBy('createdAt', 'desc'), limit(10)));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

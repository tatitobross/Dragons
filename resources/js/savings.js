export function moneyToCents(value, label = 'monto') {
    let text = String(value ?? '').trim();
    if (text.startsWith('.')) text = `0${text}`;
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
        throw new Error(`Escribe un ${label} válido, con un máximo de dos decimales.`);
    }
    const [whole, fraction = ''] = text.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents)) throw new Error(`El ${label} es demasiado grande.`);
    return cents;
}

export function applySavingsMovement(currentAmount, { type, amount }) {
    if (type !== 'income' && type !== 'expense') throw new Error('Selecciona si deseas sumar un aporte o restar un gasto.');
    const currentCents = moneyToCents(currentAmount, 'saldo');
    const movementCents = moneyToCents(amount);
    if (movementCents <= 0) throw new Error('El monto debe ser mayor que cero.');
    if (type === 'expense' && movementCents > currentCents) throw new Error('El gasto no puede ser mayor que el saldo disponible.');
    const nextCents = currentCents + (type === 'income' ? movementCents : -movementCents);
    if (!Number.isSafeInteger(nextCents)) throw new Error('El nuevo saldo es demasiado grande.');
    return {
        amount: nextCents / 100,
        previousAmount: currentCents / 100,
        movementAmount: movementCents / 100,
    };
}

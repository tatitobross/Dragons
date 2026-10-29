export function activityDetails({ title, date = '' }) {
    const name = typeof title === 'string' ? title.trim() : '';
    if (!name || name.length > 120) throw new Error('Escribe un nombre de actividad de entre 1 y 120 caracteres.');
    if (typeof date !== 'string') throw new Error('Selecciona una fecha válida.');
    if (date) {
        const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
        if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() < 1 || parsed.toISOString().slice(0, 10) !== date) throw new Error('Selecciona una fecha válida.');
    }
    return { title: name, date };
}

export function activityParticipant({ name, detail = '' }) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanDetail = typeof detail === 'string' ? detail.trim() : '';
    if (!cleanName || cleanName.length > 120) throw new Error('Escribe un nombre de entre 1 y 120 caracteres.');
    if (cleanDetail.length > 160) throw new Error('El detalle debe tener como máximo 160 caracteres.');
    return { name: cleanName, detail: cleanDetail };
}

export function activityTotals(participants = {}) {
    const people = Object.values(participants);
    const paid = people.filter(person => person.status === 'paid').length;
    return { total: people.length, paid, pending: people.length - paid };
}

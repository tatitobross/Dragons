import { activityTotals } from './activities.js';

export const escapeActivityText = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
export function activityIcon(action, label, attributes = '', remove = false) {
    const path = remove ? 'm6 6 12 12M18 6 6 18' : 'm16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z';
    return `<button type="button" class="attendance-icon ${remove ? 'attendance-delete-session' : ''}" data-activity-action="${action}" ${attributes} title="${label}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg></button>`;
}
export function activityView(activity, { admin = false, index = 0, total = 1 } = {}) {
    const escape = escapeActivityText;
    const people = Object.entries(activity.participants || {}).sort(([, a], [, b]) => String(a.name).localeCompare(String(b.name), 'es'));
    const counts = activityTotals(activity.participants);
    const rows = people.map(([id, person]) => {
        const attributes = `data-person="${escape(id)}"`;
        const paid = person.status === 'paid';
        const status = admin ? `<select data-activity-payment data-person="${escape(id)}" aria-label="Pago de ${escape(person.name)}"><option value="pending" ${!paid ? 'selected' : ''}>Pendiente</option><option value="paid" ${paid ? 'selected' : ''}>Pagado</option></select>` : `<span class="activity-status ${paid ? 'paid' : 'pending'}">${paid ? 'Pagado' : 'Pendiente'}</span>`;
        return `<tr><td><strong>${escape(person.name)}</strong>${person.detail ? `<small class="activity-person-detail">${escape(person.detail)}</small>` : ''}</td><td>${status}</td>${admin ? `<td><div class="activity-row-actions">${activityIcon('edit-person', 'Editar persona', attributes)}${activityIcon('delete-person', 'Quitar persona', attributes, true)}</div></td>` : ''}</tr>`;
    }).join('');
    const pending = people.filter(([, person]) => person.status !== 'paid');
    return `<div class="activity-board"><article class="activity-main"><div class="attendance-pager"><button type="button" data-activity-action="newer" ${index === 0 ? 'disabled' : ''}>← Más reciente</button><span>${index + 1} de ${total}</span><button type="button" data-activity-action="older" ${index === total - 1 ? 'disabled' : ''}>Actividad anterior →</button></div><div class="attendance-session-heading">${admin ? `<div class="attendance-session-actions">${activityIcon('edit', 'Editar actividad')}${activityIcon('delete', 'Eliminar actividad', '', true)}</div>` : ''}<h3>${escape(activity.title)}</h3></div>${activity.date ? `<p class="activity-date">${escape(activity.date)}</p>` : ''}<div class="activity-table-heading"><p>Personas con entrega registrada</p>${admin ? '<button type="button" class="button primary" data-activity-action="add-person">＋ Agregar persona</button>' : ''}</div><div class="activity-table-scroll"><table class="attendance-table"><thead><tr><th>Persona / Entrega</th><th>Pago</th>${admin ? '<th>Acciones</th>' : ''}</tr></thead><tbody>${rows || `<tr><td colspan="${admin ? 3 : 2}">Todavía no hay personas registradas en esta actividad.</td></tr>`}</tbody></table></div></article><aside class="activity-summary"><p class="eyebrow">ESTADO DE LA ACTIVIDAD</p><h3>Pagos pendientes</h3><div class="activity-counts"><span><strong>${counts.total}</strong>Entregas</span><span><strong>${counts.pending}</strong>Pendientes</span><span><strong>${counts.paid}</strong>Pagados</span></div><div class="activity-pending-names">${pending.map(([, person]) => `<p>${escape(person.name)}<span>Pendiente</span></p>`).join('') || `<p>${counts.total ? '¡Todos los pagos están al día!' : 'Sin entregas registradas.'}</p>`}</div></aside></div>`;
}

import { activityTotals } from './activities.js';
import { personName } from './person-name.js';

export const escapeActivityText = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
export function activityView(activity, { admin = false, index = 0, total = 1 } = {}) {
    const escape = escapeActivityText;
    const people = Object.entries(activity.participants || {}).sort(([, a], [, b]) => String(a.name).localeCompare(String(b.name), 'es'));
    const counts = activityTotals(activity.participants);
    const rows = people.map(([id, person]) => {
        const paid = person.status === 'paid';
        const status = admin ? `<select data-activity-payment data-person="${escape(id)}" aria-label="Pago de ${escape(person.name)}"><option value="pending" ${!paid ? 'selected' : ''}>Pendiente</option><option value="paid" ${paid ? 'selected' : ''}>Pagado</option></select>` : `<span class="activity-status ${paid ? 'paid' : 'pending'}">${paid ? 'Pagado' : 'Pendiente'}</span>`;
        return `<tr><td>${personName(person, { id, admin })}</td><td>${status}</td></tr>`;
    }).join('');
    const pending = people.filter(([, person]) => person.status !== 'paid');
    return `<div class="activity-board"><article class="activity-main"><div class="attendance-pager"><button type="button" data-activity-action="newer" ${index === 0 ? 'disabled' : ''}>← Más reciente</button><span>${index + 1} de ${total}</span><button type="button" data-activity-action="older" ${index === total - 1 ? 'disabled' : ''}>Actividad anterior →</button></div><h3>${escape(activity.title)}</h3>${admin ? '<div class="activity-list-actions"><button type="button" class="button" data-activity-action="edit">Editar actividad</button><button type="button" class="button attendance-delete-session" data-activity-action="delete">Eliminar actividad</button></div>' : ''}${activity.date ? `<p class="activity-date">${escape(activity.date)}</p>` : ''}<div class="activity-table-heading"><p>Personas con entrega registrada</p>${admin ? '<button type="button" class="button primary" data-activity-action="add-person">＋ Agregar persona</button>' : ''}</div><div class="activity-table-scroll"><table class="attendance-table"><thead><tr><th>Persona / Entrega</th><th>Pago</th></tr></thead><tbody>${rows || `<tr><td colspan="2">Todavía no hay personas registradas en esta actividad.</td></tr>`}</tbody></table></div></article><aside class="activity-summary"><p class="eyebrow">ESTADO DE LA ACTIVIDAD</p><h3>Pagos pendientes</h3><div class="activity-counts"><span><strong>${counts.total}</strong>Entregas</span><span><strong>${counts.pending}</strong>Pendientes</span><span><strong>${counts.paid}</strong>Pagados</span></div><div class="activity-pending-names">${pending.map(([, person]) => `<p>${escape(person.name)}<span>Pendiente</span></p>`).join('') || `<p>${counts.total ? '¡Todos los pagos están al día!' : 'Sin entregas registradas.'}</p>`}</div></aside></div>`;
}

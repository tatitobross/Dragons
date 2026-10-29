const escape = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

export function personName(person, { id, admin = false } = {}) {
    const button = (action, label, path) => `<button type="button" class="person-icon ${action === 'remove' ? 'remove' : ''}" data-person-action="${action}" data-person-id="${escape(id)}" title="${label}" aria-label="${label} a ${escape(person.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg></button>`;
    const actions = admin ? `<span class="person-row-actions">${button('edit', 'Editar', 'm16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z')}${button('remove', 'Quitar', 'm6 6 12 12M18 6 6 18')}</span>` : '';
    return `<div class="person-name-row">${actions}<span class="person-name-text"><strong>${escape(person.name)}</strong>${person.detail ? `<small>${escape(person.detail)}</small>` : ''}</span></div>`;
}

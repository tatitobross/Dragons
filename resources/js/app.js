import './bootstrap';
import '../css/overrides.css';
import { addAgendaItem, addComment, addLike, addRosterPlayer, createAttendanceSession, createPlayer, deleteClubRecord, deletePlayer, deleteRosterPlayer, firebaseEnabled, loadAttendanceSessions, loadClubUsers, loadGalleryComments, loadMemberNotices, loadPublicClubData, loadRosterPlayers, loadSavings, publishNotice, registerGuest, requestSavingsEmailLink, saveAttendanceRecord, saveClubSettings, saveSavings, signInClub, signOutClub, submitEventQuestion, updateClubRecord, updateCompetition, updateOwnPassword, updateOwnProfile, updatePlayer, updateRosterPlayer, uploadCompetitionImage, uploadGalleryMedia, uploadProfileImage, watchAttendanceSessions, watchClubSession } from './firebase';

const q = selector => document.querySelector(selector);
const qa = selector => [...document.querySelectorAll(selector)];
const modal = q('#modal');
const content = q('#modal-content');
const templates = { login: 'login-template', guest: 'guest-template', question: 'question-template', dashboard: 'dashboard-template' };
let activeUser = null;
let savingsAmount = null;
let recordCache = new Map();
let attendancePage = 0;
let pendingDebtRecord = null;
let editingContext = null;
let stopAttendanceWatch = null;

const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const normalizeName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const namesMatch = (first, second) => {
    const a = normalizeName(first); const b = normalizeName(second);
    return Boolean(a && b) && (a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `));
};
function toast(message) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; document.body.append(el); setTimeout(() => el.remove(), 3500); }
function close() { modal?.classList.remove('open'); }
function open(name) { const template = q(`#${templates[name]}`); if (!template || !modal || !content) return; content.innerHTML = template.innerHTML; modal.classList.add('open'); bindModal(name); }
function setMemberMode(user) {
    document.body.classList.toggle('member-mode', Boolean(user));
    document.body.classList.toggle('is-admin', Boolean(user?.admin));
    const button = q('.access-btn');
    if (button) button.innerHTML = user ? 'Mi espacio <span>→</span>' : 'Acceso al club <span>→</span>';
    qa('[data-profile-menu-name],[data-profile-name]').forEach(el => { el.textContent = user?.name || 'Mi perfil'; });
    qa('[data-profile-email]').forEach(el => { el.textContent = user?.firebaseUser?.email || ''; });
    qa('.profile-avatar,[data-profile-avatar]').forEach(el => { el.textContent = (user?.name || 'D').trim().slice(0, 2).toUpperCase(); });
    if (user?.avatarUrl) qa('.profile-avatar,[data-profile-avatar]').forEach(el => { el.style.backgroundImage = `url("${user.avatarUrl}")`; el.classList.add('has-photo'); });
    const profileForm = q('#profile-details-form');
    if (profileForm && user) { profileForm.elements.name.value = user.name || ''; profileForm.elements.email.value = user.firebaseUser.email || ''; }
}
function formatSavings(value) {
    const amount = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(amount) ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
}
function setSavingsAmount(value) {
    savingsAmount = formatSavings(value);
    qa('[data-savings-value],[data-admin-savings-value]').forEach(el => { el.textContent = `L ${savingsAmount}`; });
}
function updateSavingsText() { qa('[data-savings-value]').forEach(el => { el.textContent = savingsAmount === null ? 'Protegido' : `L ${savingsAmount}`; }); qa('[data-admin-savings-value]').forEach(el => { el.textContent = savingsAmount === null ? 'Sin datos' : `L ${savingsAmount}`; }); }
function showSavings() { updateSavingsText(); qa('[data-savings-message]').forEach(el => { el.textContent = 'Acceso confirmado mediante tu correo verificado.'; }); }

function renderAgenda(item) {
    const target = q('#custom-agenda'); if (!target) return;
    const el = document.createElement('article'); el.className = 'agenda-extra';
    el.innerHTML = `<p class="tag">AGENDA DEL CLUB</p><h3>${esc(item.title)}</h3><p>${esc(item.when)}<br>${esc(item.place)}</p>${item.description ? `<p>${esc(item.description)}</p>` : ''}`;
    target.append(el);
}
function agendaDate(item) {
    const parsed = Date.parse(item.when || '');
    return Number.isNaN(parsed) ? null : parsed;
}
function showUpcomingEvent(items) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const ordered = [...items].sort((a, b) => {
        const first = agendaDate(a); const second = agendaDate(b);
        if (first !== null && second !== null) return first - second;
        if (first !== null) return -1;
        if (second !== null) return 1;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    const upcoming = ordered.find(item => { const date = agendaDate(item); return date === null || date >= now.getTime(); });
    const title = q('[data-upcoming-title]'); const label = q('[data-upcoming-label]'); const detail = q('[data-upcoming-detail]');
    if (!title || !label || !detail) return;
    if (!upcoming) {
        label.hidden = true; detail.hidden = true; title.textContent = 'No hay eventos pendientes.'; detail.textContent = ''; return;
    }
    label.hidden = false; detail.hidden = false; label.textContent = 'EVENTO PRÓXIMO';
    title.textContent = upcoming.title || 'Evento del club';
    detail.textContent = [upcoming.when, upcoming.place, upcoming.description].filter(Boolean).join(' · ') || 'Consulta los detalles con el entrenador.';
}
function renderNotice(item) {
    const target = q('#notice-list'); if (!target) return;
    const el = document.createElement('article'); el.innerHTML = `<p class="tag">NUEVO</p><h4>${esc(item.title)}</h4><p>${esc(item.body)}</p>`; target.prepend(el);
}
function renderGallery(item) {
    const target = q('#uploaded-gallery'); if (!target) return;
    const media = item.mediaUrl ? (/(\.mp4|\.webm|\.mov)(\?|$)/i.test(item.mediaUrl) ? `<video controls src="${esc(item.mediaUrl)}"></video>` : `<img src="${esc(item.mediaUrl)}" alt="${esc(item.caption)}">`) : '';
    const el = document.createElement('article'); el.className = 'gallery-item uploaded-gallery-item';
    el.innerHTML = `${media}<div class="gallery-caption"><span>${esc(item.caption || 'PUBLICACIÓN DRAGONS')}</span></div>${item.description ? `<p>${esc(item.description)}</p>` : ''}`; target.append(el);
}
function renderPastCompetition(item) {
    const target = q('#past-competitions'); if (!target) return;
    if (target.dataset.empty !== 'false') { target.innerHTML = ''; target.dataset.empty = 'false'; }
    const el = document.createElement('article'); el.className = 'competition-main';
    el.innerHTML = `<span class="number">★</span><div><p class="tag">${esc(item.date)}</p><h3>${esc(item.title)}</h3><p class="competition-copy">${esc(item.description)}</p></div>`; target.append(el);
}
function renderGalleryComment(item) {
    const target = q(`[data-comment-list="${item.postId || 'general'}"]`); if (!target) return;
    const el = document.createElement('article');
    el.innerHTML = `<p class="tag">${esc(item.postId || 'GALERÍA')}</p><p>${esc(item.body)}</p>`;
    target.prepend(el);
}
function mountPhotoComments() {
    qa('.gallery-item .like[data-post-id]').forEach(button => {
        const postId = button.dataset.postId;
        const card = button.closest('.gallery-item');
        if (!card || card.querySelector('[data-comment-list]')) return;
        const box = document.createElement('div'); box.className = 'photo-comments';
        box.innerHTML = `<div data-comment-list="${esc(postId)}"></div><form data-inline-comment data-post-id="${esc(postId)}"><textarea name="body" required placeholder="Escribe un comentario..."></textarea><button class="comment-send" type="submit">Comentar</button></form>`;
        card.append(box);
    });
}
function applySettings(settings) {
    if (!settings) return;
    if (settings.heroTitle) qa('[data-hero-title]').forEach(el => { el.innerHTML = esc(settings.heroTitle).replace(/\n/g, '<br>'); });
    if (settings.heroCopy) qa('[data-hero-copy]').forEach(el => { el.textContent = settings.heroCopy; });
    if (settings.vision) qa('[data-vision]').forEach(el => { el.textContent = settings.vision; });
    if (settings.mission) qa('[data-mission]').forEach(el => { el.textContent = settings.mission; });
    if (settings.trainingWeekLabel) qa('[data-training-week-label]').forEach(el => { el.textContent = settings.trainingWeekLabel; });
    if (settings.trainingWeekTitle) qa('[data-training-week-title]').forEach(el => { el.textContent = settings.trainingWeekTitle; });
    if (settings.trainingWeek) qa('[data-training-week]').forEach(el => { el.textContent = settings.trainingWeek; });
    if (settings.trainingSundayLabel) qa('[data-training-sunday-label]').forEach(el => { el.textContent = settings.trainingSundayLabel; });
    if (settings.trainingSundayTitle) qa('[data-training-sunday-title]').forEach(el => { el.textContent = settings.trainingSundayTitle; });
    if (settings.trainingSunday) qa('[data-training-sunday]').forEach(el => { el.textContent = settings.trainingSunday; });
    if (settings.phone) qa('[data-contact-phone]').forEach(el => { el.href = `https://wa.me/${settings.phone.replace(/\D/g, '')}`; el.target = '_blank'; el.rel = 'noopener'; el.innerHTML = `${esc(settings.phone)} <span>→</span>`; });
    if (settings.email) qa('[data-contact-email]').forEach(el => { el.href = `mailto:${settings.email}`; el.innerHTML = `${esc(settings.email)} <span>→</span>`; });
    if (settings.coach) qa('[data-contact-coach]').forEach(el => { el.textContent = settings.coach; });
}
function renderRecords(items) {
    const box = q('#admin-record-list'); if (!box) return;
    recordCache = new Map(items.map(item => [`${item.collection}:${item.id}`, item]));
    box.innerHTML = items.map(item => `<div class="admin-record"><b>${esc(item.kind)}</b><span>${esc(item.title)}</span><button data-edit-record data-key="${esc(item.collection)}:${esc(item.id)}">Editar</button><button data-delete-record data-key="${esc(item.collection)}:${esc(item.id)}">Eliminar</button></div>`).join('') || '<p>Aún no hay registros creados.</p>';
}
function renderPlayerList(users) {
    const box = q('#player-list'); if (!box) return;
    box.innerHTML = users.map(user => `<div class="admin-record"><b>JUGADOR</b><span>${esc(user.name || user.email)}<small>${user.email ? ` · ${esc(user.email)}` : ' · Lista de asistencia'}</small></span><button data-edit-player="${user.id}" data-player-name="${esc(user.name || user.email)}" data-player-phone="${esc(user.phone || '')}" data-roster="${user.roster ? 'yes' : ''}">Editar</button><button data-delete-player="${user.id}" data-roster="${user.roster ? 'yes' : ''}">Borrar</button></div>`).join('') || '<p>Aún no hay jugadores registrados.</p>';
}
function renderDebtPanel(sessions, users) {
    const userById = new Map(users.map(user => [user.id, user]));
    const debts = sessions.flatMap(session => Object.entries(session.records || {})
        .filter(([, record]) => record.status === 'asistio' && record.paymentStatus === 'debe')
        .map(([userId, record]) => ({ session, userId, record, user: userById.get(userId) || { id: userId, name: 'Jugador sin nombre' } })));
    const visibleDebts = activeUser?.admin ? debts : debts.filter(item => item.userId === activeUser?.firebaseUser?.uid || item.user.name.toLowerCase() === activeUser?.name?.toLowerCase());
    const cards = visibleDebts.map(item => {
        const amount = esc(item.record.debtAmount || '0');
        if (!activeUser?.admin) return `<article class="debt-item"><b>${esc(item.user.name)}</b><span>Entreno · ${esc(item.session.date)}</span><strong>L ${amount}</strong><small>Pago pendiente</small></article>`;
        return `<form class="debt-item debt-update-form" data-debt-update data-session="${esc(item.session.id)}" data-player="${esc(item.userId)}"><div><b>${esc(item.user.name)}</b><span>Entreno · ${esc(item.session.date)}</span></div><label>Monto (L)<input name="amount" type="number" min="0.01" step="0.01" value="${amount}" required></label><label>Estado<select name="paymentStatus"><option value="debe" selected>Debe</option><option value="pago">Pagó</option></select></label><button class="button primary">Actualizar</button></form>`;
    }).join('');
    return `<aside class="debt-panel"><p class="eyebrow">PAGOS PENDIENTES</p><h3>Quiénes deben</h3><p class="debt-panel-copy">${activeUser?.admin ? 'Actualiza un pago aquí y se reflejará en la asistencia.' : 'Deudas registradas en los entrenos.'}</p><div class="debt-items">${cards || '<p class="empty-debts">No hay pagos pendientes. ¡Todo al día!</p>'}</div></aside>`;
}
function renderAttendance(sessions, users) {
    const box = q('#attendance-list'); if (!box) return;
    if (!sessions.length) { box.innerHTML = '<p>Aún no hay listas de asistencia creadas.</p>'; return; }
    attendancePage = Math.max(0, Math.min(attendancePage, sessions.length - 1));
    const session = sessions[attendancePage];
    const visibleUsers = users;
    const rows = visibleUsers.map(user => {
        const record = session.records?.[user.id] || {}; const status = record.status || '';
        if (!activeUser?.admin) return `<tr><td>${esc(user.name)}</td><td>${esc(status || 'Pendiente')}</td><td>${status === 'asistio' ? esc(record.paymentStatus || 'Pendiente') : '—'}</td></tr>`;
        return `<tr data-session="${session.id}" data-player="${user.id}"><td>${esc(user.name)}</td><td><select data-attendance-status><option value="">Pendiente</option><option value="asistio" ${status === 'asistio' ? 'selected' : ''}>Asistió</option><option value="falto" ${status === 'falto' ? 'selected' : ''}>Faltó</option></select></td><td>${status === 'asistio' ? `<select data-payment-status><option value="pago" ${record.paymentStatus === 'pago' ? 'selected' : ''}>Pago</option><option value="debe" ${record.paymentStatus === 'debe' ? 'selected' : ''}>Debe</option></select>${record.paymentStatus === 'debe' ? `<small class="debt-badge">Debe: L ${esc(record.debtAmount || '0')}</small>` : ''}` : 'Marca asistencia primero'}</td></tr>`;
    }).join('');
    box.innerHTML = `<div class="attendance-split ${activeUser?.admin ? '' : 'athlete-attendance'}"><article class="attendance-list"><div class="attendance-pager"><button data-attendance-prev ${attendancePage === 0 ? 'disabled' : ''}>← Más reciente</button><span>${attendancePage + 1} de ${sessions.length}</span><button data-attendance-next ${attendancePage === sessions.length - 1 ? 'disabled' : ''}>Entreno anterior →</button></div><h3>Entreno · ${esc(session.date)}</h3><table class="attendance-table"><thead><tr><th>Jugador</th><th>Asistencia</th><th>Pago</th></tr></thead><tbody>${rows}</tbody></table></article>${activeUser?.admin ? renderDebtPanel(sessions, users) : ''}</div>`;
}

async function syncPublicContent() {
    if (!firebaseEnabled) return;
    try {
        const [club, saving, comments] = await Promise.all([loadPublicClubData(), loadSavings().catch(() => null), loadGalleryComments()]);
        const agenda = q('#custom-agenda'); if (agenda) agenda.innerHTML = '';
        const gallery = q('#uploaded-gallery'); if (gallery) gallery.innerHTML = '';
        club.gallery.forEach(renderGallery); showUpcomingEvent(club.agenda);
        if (gallery && !club.gallery.length) gallery.innerHTML = '<p class="gallery-empty">Aún no hay publicaciones en la galería.</p>';
        mountPhotoComments(); qa('[data-comment-list]').forEach(list => { list.innerHTML = ''; }); comments.forEach(renderGalleryComment);
        if (club.competition) {
            qa('[data-competition-title]').forEach(el => { el.textContent = club.competition.title; });
            qa('[data-competition-date]').forEach(el => { el.textContent = club.competition.date; });
            qa('[data-competition-copy]').forEach(el => { el.textContent = club.competition.description || ''; });
            if (club.competition.photoUrl) qa('[data-competition-image]').forEach(el => { el.src = club.competition.photoUrl; });
        }
        if (saving && saving.amount !== undefined) setSavingsAmount(saving.amount);
        applySettings(club.settings);
        return club;
    } catch (error) { console.warn('Firebase content unavailable', error); }
}
async function syncMemberContent() {
    if (!firebaseEnabled || !activeUser) return;
    try {
        const [notices, club, users, roster, sessions, saving] = await Promise.all([
            loadMemberNotices(), loadPublicClubData(), activeUser.admin ? loadClubUsers() : Promise.resolve([]), loadRosterPlayers(),
            loadAttendanceSessions(),
            loadSavings().catch(() => null),
        ]);
        if (saving && saving.amount !== undefined) setSavingsAmount(saving.amount);
        const list = q('#notice-list'); if (list) list.innerHTML = '';
        notices.forEach(renderNotice);
        if (activeUser.admin) {
            const records = [
                ...notices.map(n => ({ ...n, kind: 'Comunicado', title: n.title, collection: 'communications', body: n.body })),
                ...club.agenda.map(n => ({ ...n, kind: 'Evento', title: n.title, collection: 'agendaItems', body: n.description || '', when: n.when, place: n.place })),
                ...club.gallery.map(n => ({ ...n, kind: 'Galería', title: n.caption, collection: 'galleryPosts', body: n.description || '' })),
                ...(club.competition ? [{ ...club.competition, id: 'competition', kind: 'Competencia actual', title: club.competition.title, collection: 'clubContent', body: club.competition.description || '', date: club.competition.date }] : []),
            ];
            renderRecords(records);
            const attendancePlayers = roster.length ? roster : users.filter(user => user.role === 'player');
            renderPlayerList(users.filter(user => user.role === 'player'));
            renderAttendance(sessions, attendancePlayers);
        }
        if (!activeUser.admin && q('#attendance-list')) {
            renderAttendance(sessions, roster.length ? roster : [{ id: activeUser.firebaseUser.uid, name: activeUser.name }]);
        }
    } catch (error) { console.warn('Member content unavailable', error); }
}
async function refreshPlayerAttendance(sessions) {
    if (!activeUser || !q('#attendance-list')) return;
    try {
        const roster = await loadRosterPlayers();
        if (activeUser.admin) {
            const users = await loadClubUsers();
            renderAttendance(sessions, roster.length ? roster : users.filter(user => user.role === 'player'));
            return;
        }
        renderAttendance(sessions, roster.length ? roster : [{ id: activeUser.firebaseUser.uid, name: activeUser.name }]);
    } catch (error) { console.warn('Attendance refresh unavailable', error); }
}
function startAttendanceWatch() {
    stopAttendanceWatch?.(); stopAttendanceWatch = null;
    if (!firebaseEnabled || !activeUser) return;
    stopAttendanceWatch = watchAttendanceSessions(sessions => refreshPlayerAttendance(sessions), error => console.warn('Attendance watcher unavailable', error));
}
async function askSavingsAccess() {
    try {
        if (!activeUser?.firebaseUser) throw new Error('Inicia sesión primero.');
        if (activeUser.admin) { const saving = await loadSavings(); if (saving && saving.amount !== undefined) setSavingsAmount(saving.amount); showSavings(); toast('Como administrador tienes acceso completo a los ahorros.'); return; }
        const verified = await requestSavingsEmailLink(activeUser.firebaseUser);
        if (verified) {
            const saving = await loadSavings();
            if (saving && saving.amount !== undefined) setSavingsAmount(saving.amount);
            showSavings(); toast('Correo confirmado. Ahorros desbloqueados.');
        } else toast('Enlace enviado. Ábrelo desde tu correo, vuelve a la web y presiona el botón otra vez.');
    } catch (error) { toast(`No fue posible verificar: ${error.message}`); }
}

function bindModal(name) {
    qa('#modal-content [data-switch]').forEach(button => button.addEventListener('click', () => open(button.dataset.switch)));
    if (name === 'login') q('#login-form')?.addEventListener('submit', async event => {
        event.preventDefault(); const data = new FormData(event.target);
        try { const result = await signInClub(data.get('username'), data.get('password')); activeUser = { name: result.profile.name || data.get('username'), admin: result.profile.role === 'admin', avatarUrl: result.profile.avatarUrl, firebaseUser: result.user }; setMemberMode(activeUser); await syncMemberContent(); open('dashboard'); }
        catch (error) { toast(`No fue posible iniciar sesión: ${error.message}`); }
    });
    if (name === 'guest') q('#guest-form')?.addEventListener('submit', async event => {
        event.preventDefault(); const data = new FormData(event.target);
        try { await registerGuest(data.get('name'), data.get('email'), data.get('password')); toast('Cuenta creada. Revisa tu correo para verificarla.'); close(); } catch (error) { toast(`No fue posible crear la cuenta: ${error.message}`); }
    });
    if (name === 'question') q('#question-form')?.addEventListener('submit', async event => {
        event.preventDefault(); const data = new FormData(event.target);
        try { await submitEventQuestion(data.get('name'), data.get('question')); toast('Consulta enviada al entrenador.'); close(); } catch (error) { toast(`No fue posible enviar: ${error.message}`); }
    });
    if (name === 'dashboard') { const userName = q('#modal-content [data-user-name]'); if (userName) userName.textContent = activeUser?.name || ''; q('#modal-content [data-logout]')?.addEventListener('click', async () => { await signOutClub(); activeUser = null; setMemberMode(null); close(); toast('Sesión cerrada.'); }); }
}
function registerAdminForm(selector, action, success) {
    q(selector)?.addEventListener('submit', async event => {
        event.preventDefault(); if (!activeUser?.admin) return toast('Solo el administrador puede realizar esta acción.');
        try { const data = Object.fromEntries(new FormData(event.target)); await action(data); event.target.reset(); if (selector === '#player-form') closeUserPlayerCard(); toast(success); await syncPublicContent(); await syncMemberContent(); } catch (error) { toast(`No fue posible guardar: ${error.message}`); }
    });
}
function closeUserPlayerCard() { q('#user-player-card-modal')?.classList.remove('open'); }
function editorField(label, name, value = '', multiline = false, type = 'text', required = true) {
    const requiredAttribute = required ? ' required' : '';
    const passwordRules = type === 'password' ? ' minlength="8" autocomplete="new-password"' : '';
    const input = multiline ? `<textarea name="${name}"${requiredAttribute}>${esc(value)}</textarea>` : `<input name="${name}"${requiredAttribute}${passwordRules} type="${type}" value="${esc(value)}">`;
    return `<label>${label}${input}</label>`;
}
function openEditor(context) {
    if (context.type === 'record' && context.record.collection === 'users') {
        context = { type: 'player', id: context.record.id, roster: false, name: context.record.name || context.record.title, phone: context.record.phone || context.record.body || '' };
    }
    editingContext = context;
    const form = q('#admin-edit-form'); const fields = q('#admin-edit-fields');
    if (!form || !fields) return;
    const kind = q('[data-editor-kind]'); const title = q('[data-editor-title]'); const copy = q('[data-editor-copy]');
    const record = context.record;
    if (context.type === 'player') {
        kind.textContent = 'JUGADOR'; title.textContent = 'Editar atleta'; copy.textContent = 'Actualiza los datos de acceso visibles del jugador.';
        fields.innerHTML = editorField('Nombre completo', 'name', context.name) + (context.roster ? '' : editorField('Teléfono', 'phone', context.phone || '')) + (context.roster ? '' : editorField('Nueva contraseña (opcional)', 'password', '', false, 'password', false));
    } else if (record.collection === 'agendaItems') {
        kind.textContent = 'EVENTO'; title.textContent = 'Editar evento'; copy.textContent = 'Modifica la información que aparece en la agenda.';
        fields.innerHTML = editorField('Nombre del evento', 'title', record.title) + editorField('Fecha y hora', 'when', record.when || '') + editorField('Lugar', 'place', record.place || '') + editorField('Descripción', 'body', record.body || '', true);
    } else if (record.collection === 'galleryPosts') {
        kind.textContent = 'GALERÍA'; title.textContent = 'Editar publicación'; copy.textContent = 'Cambia el título o la descripción de la publicación.';
        fields.innerHTML = editorField('Título', 'title', record.title) + editorField('Descripción', 'body', record.body || '', true);
    } else if (record.collection === 'communications') {
        kind.textContent = 'COMUNICADO'; title.textContent = 'Editar comunicado'; copy.textContent = 'Ajusta el mensaje que verán los atletas.';
        fields.innerHTML = editorField('Título', 'title', record.title) + editorField('Mensaje', 'body', record.body || '', true);
    } else if (record.collection === 'clubContent' && record.id === 'competition') {
        kind.textContent = 'COMPETENCIA'; title.textContent = 'Editar competencia'; copy.textContent = 'Esta información reemplaza la competencia actual.';
        fields.innerHTML = editorField('Nombre del torneo', 'title', record.title) + editorField('Fecha', 'date', record.date || '') + editorField('URL de la foto', 'photoUrl', record.photoUrl || '', false, 'url', false) + editorField('Información', 'body', record.body || '', true);
    } else {
        kind.textContent = record.kind || 'REGISTRO'; title.textContent = 'Editar registro'; copy.textContent = 'Actualiza esta publicación.';
        fields.innerHTML = editorField('Título', 'title', record.title) + editorField('Descripción', 'body', record.body || '', true);
    }
    q('#admin-edit-modal')?.classList.add('open');
    fields.querySelector('input,textarea')?.focus();
}
function closeEditor() { q('#admin-edit-modal')?.classList.remove('open'); editingContext = null; }
async function saveEditor(data) {
    if (!editingContext) return;
    if (editingContext.type === 'player') {
        if (editingContext.roster) await updateRosterPlayer(editingContext.id, data.name);
        else await updatePlayer({ uid: editingContext.id, name: data.name, phone: data.phone || '', ...(data.password ? { password: data.password } : {}) });
        return;
    }
    const record = editingContext.record;
    const values = record.collection === 'galleryPosts' ? { caption: data.title, description: data.body } : { title: data.title, description: data.body };
    if (record.collection === 'communications') { values.body = data.body; delete values.description; }
    if (record.collection === 'agendaItems') { values.when = data.when; values.place = data.place; }
    if (record.collection === 'clubContent' && record.id === 'competition') { values.date = data.date; values.photoUrl = data.photoUrl || ''; }
    await updateClubRecord(record.collection, record.id, values);
}

qa('[data-modal]').forEach(button => button.addEventListener('click', () => activeUser && button.classList.contains('access-btn') ? open('dashboard') : open(button.dataset.modal)));
q('.modal-close')?.addEventListener('click', close);
modal?.addEventListener('click', event => { if (event.target === modal) close(); });
q('.profile-trigger')?.addEventListener('click', () => q('.profile-menu')?.classList.toggle('open'));
qa('[data-logout]').forEach(button => button.addEventListener('click', async () => { stopAttendanceWatch?.(); stopAttendanceWatch = null; await signOutClub(); activeUser = null; setMemberMode(null); q('.profile-menu')?.classList.remove('open'); toast('Sesión cerrada.'); }));
q('[data-private-token]')?.addEventListener('click', askSavingsAccess);
q('#create-user-player')?.addEventListener('click', () => {
    if (!activeUser?.admin) return toast('Solo el administrador puede crear usuarios-jugadores.');
    q('#user-player-card-modal')?.classList.add('open');
    q('#player-form input[name="name"]')?.focus();
});
q('.user-player-card-close')?.addEventListener('click', closeUserPlayerCard);
q('.cancel-user-player-card')?.addEventListener('click', closeUserPlayerCard);
q('#user-player-card-modal')?.addEventListener('click', event => { if (event.target === q('#user-player-card-modal')) closeUserPlayerCard(); });
q('.admin-edit-close')?.addEventListener('click', closeEditor);
q('.cancel-admin-edit')?.addEventListener('click', closeEditor);
q('#admin-edit-modal')?.addEventListener('click', event => { if (event.target === q('#admin-edit-modal')) closeEditor(); });
q('#admin-edit-form')?.addEventListener('submit', async event => {
    event.preventDefault(); if (!activeUser?.admin) return toast('Solo el administrador puede editar.');
    try { await saveEditor(Object.fromEntries(new FormData(event.target))); closeEditor(); toast('Cambios guardados.'); await syncPublicContent(); await syncMemberContent(); }
    catch (error) { toast(`No fue posible guardar los cambios: ${error.message}`); }
});
registerAdminForm('#savings-form', async data => { const savedAmount = await saveSavings(data.amount); setSavingsAmount(savedAmount); showSavings(); }, 'Ahorro actualizado y guardado en Firebase.');
registerAdminForm('#contact-form', data => saveClubSettings(data), 'Contactos actualizados.');
registerAdminForm('#site-form', data => saveClubSettings(data), 'Contenido del sitio actualizado.');
registerAdminForm('#notice-form', data => publishNotice(data), 'Comunicado publicado.');
registerAdminForm('#agenda-form', data => addAgendaItem(data), 'Evento agregado a la agenda.');
registerAdminForm('#training-form', data => saveClubSettings(data), 'Entrenos fijos actualizados.');
q('#competition-form')?.addEventListener('submit', async event => {
    event.preventDefault(); if (!activeUser?.admin) return toast('Solo el administrador puede publicar una competencia.');
    try {
        const formData = new FormData(event.target); const file = formData.get('competitionImage');
        const currentClub = await loadPublicClubData();
        const photoUrl = file?.size ? await uploadCompetitionImage(file) : (currentClub.competition?.photoUrl || '');
        await updateCompetition({ title: formData.get('title'), date: formData.get('date'), description: formData.get('description'), photoUrl });
        event.target.reset(); toast('Competencia y foto publicadas. Reemplazó la anterior.'); await syncPublicContent(); await syncMemberContent();
    } catch (error) { toast(`No fue posible publicar la competencia: ${error.message}`); }
});
registerAdminForm('#player-form', data => createPlayer(data), 'Jugador creado con acceso de jugador.');
q('#gallery-upload-form')?.addEventListener('submit', async event => {
    event.preventDefault(); if (!activeUser?.admin) return toast('Solo el administrador puede subir contenido.');
    try { const data = new FormData(event.target); await uploadGalleryMedia(activeUser.firebaseUser, data.get('media'), data.get('caption'), data.get('description')); event.target.reset(); toast('Contenido subido a la galería.'); await syncPublicContent(); await syncMemberContent(); } catch (error) { toast(`No fue posible subir: ${error.message}`); }
});
q('#profile-photo-form')?.addEventListener('submit', async event => {
    event.preventDefault(); try { const file = new FormData(event.target).get('avatar'); if (!activeUser?.firebaseUser) throw new Error('Inicia sesión primero.'); const avatarUrl = await uploadProfileImage(activeUser.firebaseUser, file); activeUser.avatarUrl = avatarUrl; setMemberMode(activeUser); event.target.reset(); toast('Foto de perfil actualizada.'); } catch (error) { toast(`No fue posible guardar: ${error.message}. La vista previa permanece; para guardarla en línea activa Firebase Storage.`); }
});
q('#profile-photo-form input[name="avatar"]')?.addEventListener('change', event => {
    const file = event.target.files?.[0]; if (!file) return; const preview = URL.createObjectURL(file); qa('[data-profile-avatar],.large-avatar').forEach(el => { el.style.backgroundImage = `url("${preview}")`; el.classList.add('has-photo'); });
});
q('#profile-details-form')?.addEventListener('submit', async event => {
    event.preventDefault(); try { if (!activeUser?.firebaseUser) throw new Error('Inicia sesión primero.'); const data = Object.fromEntries(new FormData(event.target)); await updateOwnProfile(activeUser.firebaseUser, data); activeUser.name = data.name; setMemberMode(activeUser); toast('Perfil actualizado.'); } catch (error) { toast(`No fue posible actualizar: ${error.message}`); }
});
q('#password-form')?.addEventListener('submit', async event => {
    event.preventDefault(); try { if (!activeUser?.firebaseUser) throw new Error('Inicia sesión primero.'); await updateOwnPassword(activeUser.firebaseUser, new FormData(event.target).get('password')); event.target.reset(); toast('Contraseña actualizada.'); } catch (error) { toast(`No fue posible actualizar: ${error.message}`); }
});
q('#comment-form')?.addEventListener('submit', async event => {
    event.preventDefault(); try { const body = new FormData(event.target).get('body'); if (!activeUser?.firebaseUser) throw new Error('Inicia sesión primero.'); await addComment(activeUser.firebaseUser, body); event.target.reset(); toast('Comentario publicado.'); } catch (error) { toast(`No fue posible publicar: ${error.message}`); }
});
q('#gallery-comment-form')?.addEventListener('submit', async event => {
    event.preventDefault(); try { const data = new FormData(event.target); if (!activeUser?.firebaseUser) throw new Error('Inicia sesión primero.'); await addComment(activeUser.firebaseUser, data.get('body'), data.get('postId')); event.target.reset(); toast('Comentario publicado.'); await syncPublicContent(); } catch (error) { toast(`No fue posible publicar: ${error.message}`); }
});
document.addEventListener('submit', async event => {
    const form = event.target.closest('[data-inline-comment]'); if (!form) return; event.preventDefault();
    try { if (!activeUser?.firebaseUser) throw new Error('Inicia sesión para comentar.'); const body = new FormData(form).get('body'); await addComment(activeUser.firebaseUser, body, form.dataset.postId); form.reset(); toast('Comentario publicado.'); await syncPublicContent(); } catch (error) { toast(error.message); }
});
q('#admin-record-list')?.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return; const record = recordCache.get(button.dataset.key); if (!record) return;
    try {
        if (button.matches('[data-delete-record]')) { if (!confirm(`¿Eliminar ${record.kind.toLowerCase()}?`)) return; if (record.collection === 'users') await deletePlayer(record.id); else await deleteClubRecord(record.collection, record.id); toast('Registro eliminado.'); }
        if (button.matches('[data-edit-record]')) { openEditor({ type: 'record', record }); return; }
        await syncPublicContent(); await syncMemberContent();
    } catch (error) { toast(`No fue posible actualizar: ${error.message}`); }
});
q('#player-list')?.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || !activeUser?.admin) return; const uid = button.dataset.editPlayer || button.dataset.deletePlayer;
    if (button.dataset.editPlayer) return openEditor({ type: 'player', id: uid, roster: button.dataset.roster === 'yes', name: button.dataset.playerName || '', phone: button.dataset.playerPhone || '' });
    try { if (!confirm('¿Eliminar este jugador?')) return; if (button.dataset.roster) await deleteRosterPlayer(uid); else await deletePlayer(uid); toast('Jugador eliminado.'); await syncMemberContent(); } catch (error) { toast(`No fue posible actualizar jugador: ${error.message}`); }
});
q('#attendance-add-player')?.addEventListener('click', async () => {
    if (!activeUser?.admin) return; q('#player-card-modal')?.classList.add('open'); q('#roster-player-form input[name="name"]')?.focus();
});
function closePlayerCard() { q('#player-card-modal')?.classList.remove('open'); }
q('.player-card-close')?.addEventListener('click', closePlayerCard);
q('.cancel-player-card')?.addEventListener('click', closePlayerCard);
q('#player-card-modal')?.addEventListener('click', event => { if (event.target === q('#player-card-modal')) closePlayerCard(); });
q('#roster-player-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const name = new FormData(event.target).get('name')?.trim(); if (!name) return;
    try { await addRosterPlayer(name); event.target.reset(); closePlayerCard(); toast('Jugador agregado a todas las listas de asistencia.'); await syncMemberContent(); } catch (error) { toast(`No fue posible agregar: ${error.message}`); }
});
function closeDebtCard() { q('#debt-card-modal')?.classList.remove('open'); pendingDebtRecord = null; }
q('.debt-card-close')?.addEventListener('click', () => { closeDebtCard(); syncMemberContent(); });
q('.cancel-debt-card')?.addEventListener('click', () => { closeDebtCard(); syncMemberContent(); });
q('#debt-card-modal')?.addEventListener('click', event => { if (event.target === q('#debt-card-modal')) { closeDebtCard(); syncMemberContent(); } });
q('#debt-card-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const amount = new FormData(event.target).get('amount'); if (!pendingDebtRecord || !amount || Number(amount) <= 0) return toast('Indica un monto válido para la deuda.');
    try { await saveAttendanceRecord(pendingDebtRecord.sessionId, pendingDebtRecord.userId, { status: 'asistio', paymentStatus: 'debe', debtAmount: amount }); event.target.reset(); closeDebtCard(); toast('Deuda registrada.'); await syncMemberContent(); } catch (error) { toast(`No fue posible guardar deuda: ${error.message}`); }
});
q('#attendance-session-form')?.addEventListener('submit', async event => {
    event.preventDefault(); try { if (!activeUser?.admin) throw new Error('Solo el entrenador puede crear listas.'); await createAttendanceSession(new FormData(event.target).get('date')); event.target.reset(); toast('Lista de asistencia creada.'); await syncMemberContent(); } catch (error) { toast(`No fue posible crear: ${error.message}`); }
});
q('#attendance-list')?.addEventListener('change', async event => {
    const row = event.target.closest('tr[data-session]'); if (!row || !activeUser?.admin) return; const status = row.querySelector('[data-attendance-status]')?.value || ''; const paymentStatus = row.querySelector('[data-payment-status]')?.value || ''; let debtAmount = '';
    if (status === 'asistio' && paymentStatus === 'debe') { pendingDebtRecord = { sessionId: row.dataset.session, userId: row.dataset.player }; q('#debt-card-modal')?.classList.add('open'); q('#debt-card-form input[name="amount"]')?.focus(); return; }
    try { await saveAttendanceRecord(row.dataset.session, row.dataset.player, { status, ...(status === 'asistio' ? { paymentStatus: paymentStatus || 'pago', debtAmount: paymentStatus === 'debe' ? debtAmount : '' } : {}) }); await syncMemberContent(); } catch (error) { toast(`No fue posible guardar asistencia: ${error.message}`); }
});
q('#attendance-list')?.addEventListener('submit', async event => {
    const form = event.target.closest('[data-debt-update]'); if (!form) return;
    event.preventDefault(); if (!activeUser?.admin) return toast('Solo el entrenador puede actualizar pagos.');
    const data = new FormData(form); const paymentStatus = data.get('paymentStatus'); const amount = data.get('amount');
    if (paymentStatus === 'debe' && (!amount || Number(amount) <= 0)) return toast('Indica un monto válido.');
    try {
        await saveAttendanceRecord(form.dataset.session, form.dataset.player, { status: 'asistio', paymentStatus, debtAmount: paymentStatus === 'debe' ? amount : '' });
        toast(paymentStatus === 'pago' ? 'Pago registrado. El jugador ya no aparece como pendiente.' : 'Deuda actualizada.');
        await syncMemberContent();
    } catch (error) { toast(`No fue posible actualizar el pago: ${error.message}`); }
});
q('#attendance-list')?.addEventListener('click', event => {
    if (event.target.matches('[data-attendance-prev]')) { attendancePage -= 1; syncMemberContent(); }
    if (event.target.matches('[data-attendance-next]')) { attendancePage += 1; syncMemberContent(); }
});
qa('[data-like]').forEach(button => button.addEventListener('click', async () => {
    try { if (!activeUser?.firebaseUser) throw new Error('Inicia sesión para dar like.'); const result = await addLike(activeUser.firebaseUser, button.dataset.postId || 'public'); if (!result.added) return toast('Ya diste like a esta publicación.'); const count = button.querySelector('b'); count.textContent = String(Number(count.textContent) + 1); button.firstChild.textContent = '♥ '; } catch (error) { toast(error.message); }
}));

q('#gallery-comment-form')?.closest('.member-area')?.remove();
syncPublicContent();
if (firebaseEnabled) watchClubSession(result => { if (!result) { stopAttendanceWatch?.(); stopAttendanceWatch = null; activeUser = null; setMemberMode(null); return; } activeUser = { name: result.profile.name || result.user.email, admin: result.profile.role === 'admin', avatarUrl: result.profile.avatarUrl, firebaseUser: result.user }; setMemberMode(activeUser); syncMemberContent(); startAttendanceWatch(); });

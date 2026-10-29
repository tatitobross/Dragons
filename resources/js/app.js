import './bootstrap';
import '../css/overrides.css';
import '../css/savings.css';
import '../css/gallery.css';
import '../css/activities.css';
import { createActivityControl } from './activities-control';
import { addAgendaItem, addRosterPlayer, createAttendanceSession, createPlayer, deleteClubRecord, deletePlayer, deleteRosterPlayer, firebaseEnabled, loadAttendanceSessions, loadClubUsers, loadMemberNotices, loadPublicClubData, loadRosterPlayers, loadSavings, markPendingAttendanceAbsent, publishAttendanceSummaries, publishNotice, registerGuest, requestSavingsEmailLink, saveAttendanceRecord, saveClubSettings, signInClub, signOutClub, submitEventQuestion, updateClubRecord, updateCompetition, updateOwnPassword, updateOwnProfile, updatePlayer, updateRosterPlayer, uploadCompetitionImage, uploadGalleryMedia, uploadProfileImage, watchAttendanceSessions, watchClubSession } from './firebase';
import { addComment, addLike, loadGalleryEngagement } from './gallery-firebase';
import { bindGalleryInteractions, galleryCardHtml, galleryCommentHtml, updateGalleryLikeButton } from './gallery';
import { getPendingAttendancePlayerIds } from './attendance';
import { deleteAttendanceSession, updateAttendanceSessionDetails } from './attendance-session-firebase';
import { getRosterPlayerIds, resolveRosterAttendanceRecord } from './roster';
import { watchRosterPlayers } from './roster-firebase';
import { loadSavingsMovements, recordSavingsMovement, watchSavings } from './savings-firebase';
import { bindPasswordResetForm } from './password-reset-form';
import { loadMemberSections } from './member-content';

const q = selector => document.querySelector(selector);
const qa = selector => [...document.querySelectorAll(selector)];
const modal = q('#modal');
const content = q('#modal-content');
const templates = { login: 'login-template', guest: 'guest-template', question: 'question-template', dashboard: 'dashboard-template' };
const activityControl = createActivityControl(q('#activity-control'), { toast });
bindPasswordResetForm(q('#password-reset-form'), q('#password-reset-feedback'));
let activeUser = null;
let savingsAmount = null;
let recordCache = new Map();
let attendancePage = 0;
let attendanceFocusId = null;
let attendanceSessionContext = null;
let savingAttendanceSession = false;
let pendingDebtRecord = null;
let editingContext = null;
let stopAttendanceWatch = null;
let markingPendingSession = null;
let stopRosterWatch = null;
let stopSavingsWatch = null;
let adminPreparation = null;
let adminPreparationUid = null;
let currentAttendancePlayers = [];
let currentAttendanceSessions = [];
let clubRoster = [];
let attendanceSnapshotVersion = 0;
let rosterSnapshotVersion = 0;
let savingsSnapshotVersion = 0;
let memberSyncVersion = 0;
let galleryRefreshVersion = 0;

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
    activityControl?.setUser(user);
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
    if (!user) {
        savingsAmount = null; updateSavingsText();
        currentAttendancePlayers = []; currentAttendanceSessions = []; clubRoster = [];
        const attendance = q('#attendance-list'); if (attendance) attendance.innerHTML = '';
        const history = q('#savings-movement-list'); if (history) history.innerHTML = '';
    }
    refreshGalleryEngagement();
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

async function renderSavingsHistory() {
    const box = q('#savings-movement-list'); if (!box || !activeUser?.admin) return;
    const uid = activeUser.firebaseUser.uid;
    try {
        const movements = await loadSavingsMovements();
        if (!activeUser?.admin || activeUser.firebaseUser.uid !== uid) return;
        box.innerHTML = movements.map(movement => {
            const expense = movement.type === 'expense';
            const date = new Date(movement.createdAt);
            const when = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es-HN', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' });
            return `<article class="savings-movement ${expense ? 'expense' : 'income'}"><span>${expense ? 'Gasto' : 'Aporte'}</span><strong>${expense ? '−' : '+'} L ${formatSavings(movement.amount)}</strong><small>${esc([movement.note, when, `Saldo: L ${formatSavings(movement.balanceAfter)}`].filter(Boolean).join(' · '))}</small></article>`;
        }).join('') || '<p class="savings-history-empty">Los nuevos aportes y gastos aparecerán aquí.</p>';
    } catch (error) {
        if (activeUser?.firebaseUser.uid === uid) box.innerHTML = '<p class="savings-history-empty">No se pudo cargar el historial. Intenta nuevamente.</p>';
        console.warn('Savings history unavailable', error);
    }
}

function startSavingsWatch() {
    stopSavingsWatch?.(); stopSavingsWatch = null;
    if (!firebaseEnabled || !activeUser || (!activeUser.admin && !(activeUser.role === 'player' && activeUser.firebaseUser.emailVerified))) return;
    const uid = activeUser.firebaseUser.uid;
    stopSavingsWatch = watchSavings(saving => {
        if (activeUser?.firebaseUser.uid !== uid) return;
        savingsSnapshotVersion += 1;
        setSavingsAmount(saving.amount);
        renderSavingsHistory();
    }, error => console.warn('Savings watcher unavailable', error));
}

function stopMemberWatches() {
    stopAttendanceWatch?.(); stopAttendanceWatch = null;
    stopRosterWatch?.(); stopRosterWatch = null;
    stopSavingsWatch?.(); stopSavingsWatch = null;
    adminPreparation = null; adminPreparationUid = null;
    memberSyncVersion += 1;
}

async function prepareAdminData() {
    if (!activeUser?.admin) return;
    const uid = activeUser.firebaseUser.uid;
    if (!adminPreparation || adminPreparationUid !== uid) {
        adminPreparationUid = uid;
        adminPreparation = publishAttendanceSummaries().catch(error => {
            if (adminPreparationUid === uid) { adminPreparation = null; adminPreparationUid = null; }
            throw error;
        });
    }
    return adminPreparation;
}

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
    const el = document.createElement('article'); el.className = 'gallery-item uploaded-gallery-item';
    el.innerHTML = galleryCardHtml(item); target.append(el);
}
function renderPastCompetition(item) {
    const target = q('#past-competitions'); if (!target) return;
    if (target.dataset.empty !== 'false') { target.innerHTML = ''; target.dataset.empty = 'false'; }
    const el = document.createElement('article'); el.className = 'competition-main';
    el.innerHTML = `<span class="number">★</span><div><p class="tag">${esc(item.date)}</p><h3>${esc(item.title)}</h3><p class="competition-copy">${esc(item.description)}</p></div>`; target.append(el);
}
function renderGalleryComment(item) {
    const target = qa('#uploaded-gallery [data-comment-list]').find(list => list.dataset.commentList === (item.postId || 'general')); if (!target) return;
    const el = document.createElement('article');
    el.innerHTML = galleryCommentHtml(item);
    target.append(el);
}
async function refreshGalleryEngagement() {
    if (!firebaseEnabled || !q('#uploaded-gallery')) return;
    const version = ++galleryRefreshVersion;
    const user = activeUser?.firebaseUser || null;
    try {
        const engagement = await loadGalleryEngagement(user);
        if (version !== galleryRefreshVersion || user?.uid !== activeUser?.firebaseUser?.uid) return;
        qa('#uploaded-gallery [data-gallery-like]').forEach(button => updateGalleryLikeButton(button, {
            count: engagement.counts.get(button.dataset.postId) || 0,
            liked: engagement.liked.has(button.dataset.postId),
            likesAvailable: engagement.likesAvailable,
        }));
        qa('#uploaded-gallery [data-comment-list]').forEach(list => { list.innerHTML = ''; });
        engagement.comments.forEach(renderGalleryComment);
    } catch (error) { console.warn('Gallery engagement unavailable', error); }
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
function renderCoachRoster(players) {
    const box = q('#coach-roster-list'); if (!box || !activeUser?.admin) return;
    box.innerHTML = players.map(player => `<div class="admin-record"><b>ATLETA</b><span>${esc(player.name)}</span><button type="button" data-edit-roster="${esc(player.id)}" data-roster-name="${esc(player.name)}">Editar</button><button type="button" data-remove-roster="${esc(player.id)}" data-roster-name="${esc(player.name)}">Retirar</button></div>`).join('') || '<p>Aún no hay atletas en la plantilla. Agrégalos con el botón de arriba.</p>';
}
function renderDebtPanel(sessions, users) {
    if (!activeUser?.admin) return '';
    const userById = new Map(users.flatMap(user => getRosterPlayerIds(user).map(id => [id, user])));
    const debts = sessions.flatMap(session => {
        const selected = users.map(user => ({ session, user, ...resolveRosterAttendanceRecord(session.records || {}, user) }));
        const selectedIds = new Set(selected.map(item => item.playerId));
        const additional = Object.entries(session.records || {}).filter(([id]) => !selectedIds.has(id)).map(([playerId, record]) => ({
            session, playerId, record, user: userById.get(playerId) || { name: 'Jugador fuera de la plantilla' },
            needsReview: userById.has(playerId),
        }));
        return [...selected, ...additional].filter(item => item.record.status === 'asistio' && item.record.paymentStatus === 'debe');
    });
    const cards = debts.map(item => {
        const amount = esc(item.record.debtAmount || '0');
        return `<form class="debt-item debt-update-form" data-debt-update data-session="${esc(item.session.id)}" data-player="${esc(item.playerId)}"><div><b>${esc(item.user.name)}</b><span>${esc(item.session.title || 'Entreno')} · ${esc(item.session.date)}</span>${item.needsReview ? '<small>Registro anterior de una ficha vinculada. Revisa este pago por separado.</small>' : ''}</div><label>Monto (L)<input name="amount" type="number" min="0.01" step="0.01" value="${amount}" required></label><label>Estado<select name="paymentStatus"><option value="debe" selected>Debe</option><option value="pago">Pagó</option></select></label><button class="button primary">Actualizar</button></form>`;
    }).join('');
    return `<aside class="debt-panel"><p class="eyebrow">PAGOS PENDIENTES</p><h3>Quiénes deben</h3><p class="debt-panel-copy">${activeUser?.admin ? 'Actualiza un pago aquí y se reflejará en la asistencia.' : 'Deudas registradas en los entrenos.'}</p><div class="debt-items">${cards || '<p class="empty-debts">No hay pagos pendientes. ¡Todo al día!</p>'}</div></aside>`;
}
function renderAttendance(sessions, users) {
    const box = q('#attendance-list'); if (!box) return;
    currentAttendancePlayers = users; currentAttendanceSessions = sessions;
    if (!sessions.length) { box.innerHTML = '<p>Aún no hay listas de asistencia creadas.</p>'; return; }
    if (attendanceFocusId) {
        const index = sessions.findIndex(session => session.id === attendanceFocusId);
        if (index !== -1) attendancePage = index;
        attendanceFocusId = null;
    }
    attendancePage = Math.max(0, Math.min(attendancePage, sessions.length - 1));
    const session = sessions[attendancePage];
    const visibleUsers = users;
    const pendingCount = getPendingAttendancePlayerIds(session.records || {}, visibleUsers).length;
    const markingPending = markingPendingSession === session.id;
    const sessionActions = activeUser?.admin ? `<div class="attendance-session-actions"><button type="button" class="attendance-icon" data-attendance-edit-session data-session="${esc(session.id)}" title="Editar nombre y fecha" aria-label="Editar nombre y fecha"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z" /></svg></button><button type="button" class="attendance-icon attendance-delete-session" data-attendance-delete-session data-session="${esc(session.id)}" title="Eliminar lista" aria-label="Eliminar lista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>` : '';
    const attendanceActions = activeUser?.admin ? `<div class="attendance-actions"><span>${pendingCount ? `${pendingCount} ${pendingCount === 1 ? 'atleta pendiente' : 'atletas pendientes'}` : 'Sin asistencias pendientes'}</span><button type="button" class="button attendance-mark-absent" data-attendance-mark-absent data-session="${esc(session.id)}" data-pending-count="${pendingCount}" ${pendingCount === 0 || markingPending ? 'disabled' : ''} aria-busy="${markingPending}">${markingPending ? 'Guardando…' : 'Marcar pendientes como no asistió'}</button></div>` : '';
    const rows = visibleUsers.map(user => {
        const { playerId, record } = resolveRosterAttendanceRecord(session.records || {}, user); const status = record.status || '';
        if (!activeUser?.admin) return `<tr><td>${esc(user.name)}</td><td>${({ asistio: 'Asistió', falto: 'No asistió' })[status] || 'Pendiente'}</td><td>${status === 'asistio' ? ({ pago: 'Pagó', debe: 'Debe' })[record.paymentStatus] || 'Pendiente' : '—'}</td></tr>`;
        return `<tr data-session="${esc(session.id)}" data-player="${esc(playerId)}"><td>${esc(user.name)}</td><td><select data-attendance-status><option value="">Pendiente</option><option value="asistio" ${status === 'asistio' ? 'selected' : ''}>Asistió</option><option value="falto" ${status === 'falto' ? 'selected' : ''}>No asistió</option></select></td><td>${status === 'asistio' ? `<select data-payment-status><option value="" ${!record.paymentStatus ? 'selected' : ''}>Pendiente</option><option value="pago" ${record.paymentStatus === 'pago' ? 'selected' : ''}>Pagó</option><option value="debe" ${record.paymentStatus === 'debe' ? 'selected' : ''}>Debe</option></select>${record.paymentStatus === 'debe' ? `<small class="debt-badge">Debe: L ${esc(record.debtAmount || '0')}</small>` : ''}` : '—'}</td></tr>`;
    }).join('') || '<tr><td colspan="3">El entrenador aún no ha agregado atletas a la plantilla de asistencia.</td></tr>';
    box.innerHTML = `<div class="attendance-split ${activeUser?.admin ? '' : 'athlete-attendance'}"><article class="attendance-list"><div class="attendance-pager"><button data-attendance-prev ${attendancePage === 0 ? 'disabled' : ''}>← Más reciente</button><span>${attendancePage + 1} de ${sessions.length}</span><button data-attendance-next ${attendancePage === sessions.length - 1 ? 'disabled' : ''}>Lista anterior →</button></div><div class="attendance-session-heading">${sessionActions}<h3>${esc(session.title || 'Entreno')} · ${esc(session.date)}</h3></div>${attendanceActions}<table class="attendance-table"><thead><tr><th>Jugador</th><th>Asistencia</th><th>Pago</th></tr></thead><tbody>${rows}</tbody></table></article>${activeUser?.admin ? renderDebtPanel(sessions, users) : ''}</div>`;
}

async function syncPublicContent() {
    if (!firebaseEnabled) return;
    const savingsVersion = savingsSnapshotVersion;
    try {
        const [club, saving] = await Promise.all([loadPublicClubData(), loadSavings().catch(() => null)]);
        const agenda = q('#custom-agenda'); if (agenda) agenda.innerHTML = '';
        const gallery = q('#uploaded-gallery'); if (gallery) gallery.innerHTML = '';
        club.gallery.forEach(renderGallery); showUpcomingEvent(club.agenda);
        if (gallery && !club.gallery.length) gallery.innerHTML = '<p class="gallery-empty">Aún no hay publicaciones en la galería.</p>';
        if (club.competition) {
            qa('[data-competition-title]').forEach(el => { el.textContent = club.competition.title; });
            qa('[data-competition-date]').forEach(el => { el.textContent = club.competition.date; });
            qa('[data-competition-copy]').forEach(el => { el.textContent = club.competition.description || ''; });
            qa('[data-competition-media]').forEach(el => { el.hidden = !club.competition.photoUrl; });
            qa('[data-competition-image]').forEach(el => {
                if (club.competition.photoUrl) el.src = club.competition.photoUrl;
                else el.removeAttribute('src');
            });
        }
        if (saving && saving.amount !== undefined && savingsSnapshotVersion === savingsVersion) setSavingsAmount(saving.amount);
        applySettings(club.settings);
        await refreshGalleryEngagement();
        return club;
    } catch (error) { console.warn('Firebase content unavailable', error); }
}
async function syncMemberContent() {
    if (!firebaseEnabled || !activeUser) return;
    const user = activeUser;
    const syncVersion = ++memberSyncVersion;
    const isCurrent = () => activeUser?.firebaseUser.uid === user.firebaseUser.uid && memberSyncVersion === syncVersion;
    const attendanceVersion = attendanceSnapshotVersion; const rosterVersion = rosterSnapshotVersion; const savingsVersion = savingsSnapshotVersion;
    let noticeRecords = [...recordCache.values()].filter(record => record.collection === 'communications');
    let publicRecords = [...recordCache.values()].filter(record => record.collection !== 'communications');
    const preparation = prepareAdminData().catch(error => {
        console.warn('Admin preparation incomplete; independent sections remain available', error);
    });
    const loaders = {
        notices: () => loadMemberNotices(),
        club: () => loadPublicClubData(),
        savings: () => loadSavings(),
        roster: async () => { await preparation; return loadRosterPlayers(); },
        attendance: async () => { await preparation; return loadAttendanceSessions({ admin: user.admin }); },
        ...(user.admin ? { users: () => loadClubUsers() } : {}),
    };
    await loadMemberSections(loaders, {
        isCurrent,
        onSection(section, value) {
            if (section === 'users') renderPlayerList(value.filter(player => player.role === 'player'));
            if (section === 'savings' && value?.amount !== undefined && savingsSnapshotVersion === savingsVersion) setSavingsAmount(value.amount);
            if (section === 'roster') {
                if (rosterSnapshotVersion === rosterVersion) clubRoster = value;
                renderCoachRoster(clubRoster);
                renderAttendance(currentAttendanceSessions, clubRoster);
            }
            if (section === 'attendance') {
                const sessions = attendanceSnapshotVersion === attendanceVersion ? value : currentAttendanceSessions;
                renderAttendance(sessions, clubRoster);
            }
            if (section === 'notices') {
                const list = q('#notice-list'); if (list) list.innerHTML = '';
                value.forEach(renderNotice);
                noticeRecords = value.map(n => ({ ...n, kind: 'Comunicado', title: n.title, collection: 'communications', body: n.body }));
                if (user.admin) renderRecords([...noticeRecords, ...publicRecords]);
            }
            if (section === 'club' && user.admin) {
                publicRecords = [
                    ...value.agenda.map(n => ({ ...n, kind: 'Evento', title: n.title, collection: 'agendaItems', body: n.description || '', when: n.when, place: n.place })),
                    ...value.gallery.map(n => ({ ...n, kind: 'Galería', title: n.caption, collection: 'galleryPosts', body: n.description || '' })),
                    ...(value.competition ? [{ ...value.competition, id: 'competition', kind: 'Competencia actual', title: value.competition.title, collection: 'clubContent', body: value.competition.description || '', date: value.competition.date }] : []),
                ];
                renderRecords([...noticeRecords, ...publicRecords]);
            }
        },
        onError(section, error) {
            console.warn(`Member section unavailable: ${section}`, error);
            const selector = section === 'users' ? '#player-list' : section === 'attendance' ? '#attendance-list' : null;
            const box = selector ? q(selector) : null;
            if (box && !box.innerHTML.trim()) {
                box.innerHTML = `<p>No fue posible cargar ${section === 'users' ? 'los usuarios' : 'la asistencia'}. Revisa los permisos o intenta nuevamente.</p><button type="button" class="button" data-retry-member-content>Volver a intentar</button>`;
            }
        },
    });
}
function refreshPlayerAttendance(sessions) {
    if (!activeUser || !q('#attendance-list')) return;
    attendanceSnapshotVersion += 1;
    renderAttendance(sessions, clubRoster);
}
async function startAttendanceWatch() {
    stopAttendanceWatch?.(); stopAttendanceWatch = null;
    stopRosterWatch?.(); stopRosterWatch = null;
    if (!firebaseEnabled || !activeUser || (!q('#attendance-list') && !q('#coach-roster-list'))) return;
    const user = activeUser;
    try {
        // Watch readable data immediately, even when migration of another collection fails.
        prepareAdminData().catch(error => console.warn('Attendance preparation incomplete; watchers remain active', error));
        if (activeUser?.firebaseUser.uid !== user.firebaseUser.uid) return;
        if (q('#attendance-list')) stopAttendanceWatch = watchAttendanceSessions(sessions => {
            if (activeUser?.firebaseUser.uid === user.firebaseUser.uid) refreshPlayerAttendance(sessions);
        }, error => {
            console.warn('Attendance watcher unavailable', error);
            toast('No se pudo cargar la asistencia. Intenta nuevamente.');
        }, { admin: user.admin });
        stopRosterWatch = watchRosterPlayers(roster => {
            if (activeUser?.firebaseUser.uid !== user.firebaseUser.uid) return;
            rosterSnapshotVersion += 1;
            clubRoster = roster;
            renderCoachRoster(roster);
            renderAttendance(currentAttendanceSessions, roster);
        }, error => console.warn('Roster watcher unavailable', error));
    } catch (error) {
        console.warn('Attendance preparation unavailable', error);
        toast('No se pudo preparar la plantilla de asistencia. Intenta nuevamente.');
    }
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
            startSavingsWatch();
        } else toast('Enlace enviado. Ábrelo desde tu correo, vuelve a la web y presiona el botón otra vez.');
    } catch (error) { toast(`No fue posible verificar: ${error.message}`); }
}

function bindModal(name) {
    qa('#modal-content [data-switch]').forEach(button => button.addEventListener('click', () => {
        const email = q('#modal-content input[type="email"]')?.value || '';
        open(button.dataset.switch);
        if (button.dataset.switch === 'login') {
            const field = q('#modal-content input[type="email"]');
            if (field) { field.value = email.trim(); field.focus(); }
        }
    }));
    if (name === 'login') q('#login-form')?.addEventListener('submit', async event => {
        event.preventDefault(); const data = new FormData(event.target);
        try { const result = await signInClub(data.get('username'), data.get('password')); activeUser = { name: result.profile.name || data.get('username'), role: result.profile.role, admin: result.profile.role === 'admin', avatarUrl: result.profile.avatarUrl, firebaseUser: result.user }; setMemberMode(activeUser); await syncMemberContent(); open('dashboard'); }
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
    if (name === 'dashboard') { const userName = q('#modal-content [data-user-name]'); if (userName) userName.textContent = activeUser?.name || ''; q('#modal-content [data-logout]')?.addEventListener('click', async () => { stopMemberWatches(); await signOutClub(); activeUser = null; setMemberMode(null); close(); toast('Sesión cerrada.'); }); }
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
        kind.textContent = context.roster ? 'PLANTILLA DE ASISTENCIA' : 'CUENTA DE ACCESO'; title.textContent = context.roster ? 'Editar atleta' : 'Editar usuario'; copy.textContent = context.roster ? 'Actualiza el nombre del atleta en la plantilla de asistencia.' : 'Actualiza los datos de acceso del usuario de la página.';
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
qa('[data-logout]').forEach(button => button.addEventListener('click', async () => { stopMemberWatches(); await signOutClub(); activeUser = null; setMemberMode(null); q('.profile-menu')?.classList.remove('open'); toast('Sesión cerrada.'); }));
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
q('#savings-form')?.addEventListener('input', event => { delete event.currentTarget.dataset.operationId; });
q('#savings-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!activeUser?.admin) return toast('Solo el administrador puede registrar aportes y gastos.');
    const form = event.currentTarget;
    if (form.dataset.saving === 'true') return;
    const data = Object.fromEntries(new FormData(form));
    form.dataset.saving = 'true';
    const savingsVersion = savingsSnapshotVersion;
    const controls = [...form.elements].map(control => ({ control, disabled: control.disabled }));
    controls.forEach(({ control }) => { control.disabled = true; });
    const submit = form.querySelector('[type="submit"]'); const label = submit.textContent;
    submit.textContent = 'Guardando…';
    try {
        if (!globalThis.crypto?.getRandomValues) throw new Error('No se pudo identificar el movimiento. Recarga la página.');
        form.dataset.operationId ||= globalThis.crypto.randomUUID?.() || [...globalThis.crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('');
        const result = await recordSavingsMovement({ ...data, operationId: form.dataset.operationId });
        if (savingsSnapshotVersion === savingsVersion) setSavingsAmount(result.amount);
        form.reset(); delete form.dataset.operationId;
        toast(result.alreadyApplied ? 'Este movimiento ya estaba guardado; el saldo está actualizado.' : `${data.type === 'expense' ? 'Gasto' : 'Aporte'} registrado. Saldo: L ${formatSavings(result.amount)}.`);
        await renderSavingsHistory();
    } catch (error) { toast(`No fue posible guardar el movimiento: ${error.message}`); }
    finally {
        delete form.dataset.saving;
        controls.forEach(({ control, disabled }) => { control.disabled = disabled; });
        submit.textContent = label;
    }
});
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
q('#admin-record-list')?.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return; const record = recordCache.get(button.dataset.key); if (!record) return;
    try {
        if (button.matches('[data-delete-record]')) { if (!confirm(`¿Eliminar ${record.kind.toLowerCase()}?`)) return; if (record.collection === 'users') await deletePlayer(record.id); else await deleteClubRecord(record.collection, record.id); toast('Registro eliminado.'); }
        if (button.matches('[data-edit-record]')) { openEditor({ type: 'record', record }); return; }
        await syncPublicContent(); await syncMemberContent();
    } catch (error) { toast(`No fue posible actualizar: ${error.message}`); }
});
q('#player-list')?.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || !activeUser?.admin) return;
    if (button.matches('[data-retry-member-content]')) return syncMemberContent();
    const uid = button.dataset.editPlayer || button.dataset.deletePlayer; if (!uid) return;
    if (button.dataset.editPlayer) return openEditor({ type: 'player', id: uid, roster: button.dataset.roster === 'yes', name: button.dataset.playerName || '', phone: button.dataset.playerPhone || '' });
    try { if (!confirm('¿Eliminar este jugador?')) return; if (button.dataset.roster) await deleteRosterPlayer(uid); else await deletePlayer(uid); toast('Jugador eliminado.'); await syncMemberContent(); } catch (error) { toast(`No fue posible actualizar jugador: ${error.message}`); }
});
q('#attendance-add-player')?.addEventListener('click', async () => {
    if (!activeUser?.admin) return; q('#player-card-modal')?.classList.add('open'); q('#roster-player-form input[name="name"]')?.focus();
});
function closePlayerCard() { q('#player-card-modal')?.classList.remove('open'); }
q('#player-card-modal .player-card-close')?.addEventListener('click', closePlayerCard);
q('.cancel-player-card')?.addEventListener('click', closePlayerCard);
q('#player-card-modal')?.addEventListener('click', event => { if (event.target === q('#player-card-modal')) closePlayerCard(); });
q('#roster-player-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const name = new FormData(event.target).get('name')?.trim(); if (!name) return;
    if (!activeUser?.admin) return toast('Solo el entrenador puede agregar atletas a la asistencia.');
    const form = event.target; const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    try { await addRosterPlayer(name); form.reset(); closePlayerCard(); toast('Atleta agregado a la plantilla de asistencia.'); await syncMemberContent(); } catch (error) { toast(`No fue posible agregar: ${error.message}`); }
    finally { button.disabled = false; }
});
q('#coach-roster-list')?.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || !activeUser?.admin) return;
    if (button.dataset.editRoster) return openEditor({ type: 'player', roster: true, id: button.dataset.editRoster, name: button.dataset.rosterName });
    if (button.dataset.removeRoster) {
        q('#roster-remove-form input[name="playerId"]').value = button.dataset.removeRoster;
        q('[data-roster-remove-name]').textContent = button.dataset.rosterName;
        q('#roster-remove-modal').classList.add('open');
    }
});
function closeRosterRemove() { q('#roster-remove-modal')?.classList.remove('open'); }
q('#roster-remove-modal .player-card-close')?.addEventListener('click', closeRosterRemove);
q('.cancel-roster-remove')?.addEventListener('click', closeRosterRemove);
q('#roster-remove-modal')?.addEventListener('click', event => { if (event.target === q('#roster-remove-modal')) closeRosterRemove(); });
q('#roster-remove-form')?.addEventListener('submit', async event => {
    event.preventDefault(); if (!activeUser?.admin) return;
    const form = event.currentTarget; const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    try { await deleteRosterPlayer(new FormData(form).get('playerId')); closeRosterRemove(); toast('Atleta retirado de la plantilla. Su historial se conserva.'); await syncMemberContent(); }
    catch (error) { toast(`No fue posible retirar al atleta: ${error.message}`); }
    finally { button.disabled = false; }
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
    event.preventDefault(); try { if (!activeUser?.admin) throw new Error('Solo el entrenador puede crear listas.'); const data = new FormData(event.target); await createAttendanceSession(data.get('date'), data.get('title')); event.target.reset(); toast('Lista de asistencia creada.'); await syncMemberContent(); } catch (error) { toast(`No fue posible crear: ${error.message}`); }
});
function closeAttendanceSessionCard() {
    if (savingAttendanceSession) return;
    q('#attendance-session-modal')?.classList.remove('open');
    attendanceSessionContext = null;
}
qa('[data-close-attendance-session]').forEach(button => button.addEventListener('click', closeAttendanceSessionCard));
q('#attendance-session-modal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeAttendanceSessionCard();
});
q('#attendance-session-edit-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!activeUser?.admin || !attendanceSessionContext || savingAttendanceSession) return;
    const { id, action } = attendanceSessionContext;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const controls = [...event.currentTarget.elements];
    const submit = q('[data-attendance-session-save]'); const label = submit.textContent;
    savingAttendanceSession = true;
    controls.forEach(control => { control.disabled = true; }); submit.textContent = 'Guardando…';
    let saved = false;
    try {
        if (action === 'delete') await deleteAttendanceSession(id);
        else { attendanceFocusId = id; await updateAttendanceSessionDetails(id, data); }
        saved = true;
        toast(action === 'delete' ? 'Lista eliminada.' : 'Lista actualizada. Las asistencias y pagos se conservaron.');
    } catch (error) {
        attendanceFocusId = null;
        toast(`No fue posible guardar: ${error.message}`);
    } finally {
        savingAttendanceSession = false;
        controls.forEach(control => { control.disabled = false; }); submit.textContent = label;
    }
    if (saved) { closeAttendanceSessionCard(); await syncMemberContent(); }
});
q('#attendance-list')?.addEventListener('change', async event => {
    const row = event.target.closest('tr[data-session]'); if (!row || !activeUser?.admin) return; const status = row.querySelector('[data-attendance-status]')?.value || ''; const paymentStatus = row.querySelector('[data-payment-status]')?.value || '';
    if (status === 'asistio' && paymentStatus === 'debe') { pendingDebtRecord = { sessionId: row.dataset.session, userId: row.dataset.player }; q('#debt-card-modal')?.classList.add('open'); q('#debt-card-form input[name="amount"]')?.focus(); return; }
    try { await saveAttendanceRecord(row.dataset.session, row.dataset.player, { status, ...(status === 'asistio' ? { paymentStatus, debtAmount: '' } : {}) }); await syncMemberContent(); } catch (error) { toast(`No fue posible guardar asistencia: ${error.message}`); }
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
q('#attendance-list')?.addEventListener('click', async event => {
    if (event.target.closest('[data-retry-member-content]')) return syncMemberContent();
    const sessionButton = event.target.closest('[data-attendance-edit-session],[data-attendance-delete-session]');
    if (sessionButton) {
        if (!activeUser?.admin || savingAttendanceSession) return;
        const session = currentAttendanceSessions.find(item => item.id === sessionButton.dataset.session);
        if (!session) return;
        const deleting = sessionButton.hasAttribute('data-attendance-delete-session');
        attendanceSessionContext = { id: session.id, action: deleting ? 'delete' : 'date' };
        q('#attendance-session-title').textContent = deleting ? 'Eliminar lista' : 'Editar lista';
        q('[data-attendance-session-copy]').textContent = deleting ? `Se eliminará «${session.title || 'Entreno'} · ${session.date}», con sus asistencias y pagos registrados. Esta acción no se puede deshacer. Las cuentas y la plantilla de atletas se conservan.` : 'Cambia el nombre o la fecha. Las asistencias y los pagos registrados se conservan.';
        const name = q('#attendance-session-edit-form input[name="title"]');
        name.value = session.title || 'Entreno'; name.required = !deleting;
        q('[data-attendance-session-name]').hidden = deleting;
        const date = q('#attendance-session-edit-form input[name="date"]');
        date.value = session.date; date.required = !deleting;
        q('[data-attendance-session-date]').hidden = deleting;
        const submit = q('[data-attendance-session-save]');
        submit.textContent = deleting ? 'Sí, eliminar lista' : 'Guardar cambios →';
        submit.classList.toggle('attendance-delete-session', deleting);
        q('#attendance-session-modal').classList.add('open');
        (deleting ? q('#attendance-session-edit-form [data-close-attendance-session]') : name).focus();
        return;
    }
    const bulkButton = event.target.closest('[data-attendance-mark-absent]');
    if (bulkButton) {
        if (!activeUser?.admin || bulkButton.disabled || markingPendingSession) return;
        const players = [...currentAttendancePlayers];
        markingPendingSession = bulkButton.dataset.session;
        bulkButton.disabled = true;
        bulkButton.setAttribute('aria-busy', 'true');
        bulkButton.textContent = 'Guardando…';
        try {
            const count = await markPendingAttendanceAbsent(markingPendingSession, players);
            toast(count ? `${count} ${count === 1 ? 'atleta marcado' : 'atletas marcados'} como «No asistió».` : 'Ya no hay asistencias pendientes en esta lista.');
        } catch (error) {
            toast(`No fue posible marcar los pendientes: ${error.message}`);
        } finally {
            markingPendingSession = null;
            qa('[data-attendance-mark-absent]').forEach(button => {
                button.disabled = Number(button.dataset.pendingCount) === 0;
                button.setAttribute('aria-busy', 'false');
                button.textContent = 'Marcar pendientes como no asistió';
            });
            await syncMemberContent();
        }
        return;
    }
    if (event.target.matches('[data-attendance-prev]')) { attendancePage -= 1; syncMemberContent(); }
    if (event.target.matches('[data-attendance-next]')) { attendancePage += 1; syncMemberContent(); }
});
bindGalleryInteractions(q('#uploaded-gallery'), {
    getUser: () => activeUser?.firebaseUser,
    addLike,
    addComment,
    onLike: () => refreshGalleryEngagement(),
    onComment: () => { toast('Comentario publicado.'); return refreshGalleryEngagement(); },
    onError: message => toast(message),
});

q('#gallery-comment-form')?.closest('.member-area')?.remove();
syncPublicContent();
if (firebaseEnabled) watchClubSession(result => { if (!result) { stopMemberWatches(); activeUser = null; setMemberMode(null); return; } activeUser = { name: result.profile.name || result.user.email, role: result.profile.role, admin: result.profile.role === 'admin', avatarUrl: result.profile.avatarUrl, firebaseUser: result.user }; setMemberMode(activeUser); syncMemberContent(); startAttendanceWatch(); startSavingsWatch(); });

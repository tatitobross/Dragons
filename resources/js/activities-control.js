import { addActivityParticipant, createActivity, deleteActivity, removeActivityParticipant, setActivityPayment, updateActivity, updateActivityParticipant, watchActivities } from './activities-firebase.js';
import { activityView, escapeActivityText as escape } from './activities-view.js';

export function createActivityControl(root, { toast }) {
    if (!root) return null;
    const find = selector => root.querySelector(selector);
    const list = find('[data-activity-list]');
    const modal = find('[data-activity-modal]');
    const editor = find('[data-activity-editor]');
    let user = null, activities = [], page = 0, focusId = null, context = null, unsubscribe = null, generation = 0, busy = false, error = '', loading = false;
    const current = () => activities[page];
    function render() {
        if (!user) { list.innerHTML = ''; return; }
        page = Math.max(0, Math.min(page, activities.length - 1));
        const warning = error ? '<p class="activity-error" role="alert">No fue posible cargar las actividades. Revisa tu conexión o intenta nuevamente.</p><button type="button" class="button" data-activity-action="retry">Volver a intentar</button>' : '';
        list.innerHTML = warning + (activities.length ? activityView(current(), { admin: user.admin, index: page, total: activities.length }) : `<div class="activity-empty"><h3>${loading ? 'Cargando actividades…' : 'Aún no hay actividades'}</h3><p>${loading ? 'Consultando las listas del club.' : user.admin ? 'Crea una actividad y agrega a las personas que recibieron una entrega.' : 'Las actividades del club aparecerán aquí.'}</p></div>`);
    }
    function close(force = false) {
        if (busy && !force) return;
        modal.classList.remove('open'); context = null;
    }
    async function save(form, action, onSuccess) {
        if (busy || !user?.admin) return;
        const version = generation;
        busy = true;
        const controls = [...form.elements].map(control => [control, control.disabled]);
        controls.forEach(([control]) => { control.disabled = true; });
        const button = form.querySelector('[type="submit"]'); const label = button?.textContent;
        if (button) button.textContent = 'Guardando…';
        try {
            const result = await action();
            if (version === generation) onSuccess?.(result);
        } catch (failure) {
            if (version === generation) { toast(`No fue posible guardar: ${failure.message}`); render(); }
        } finally {
            controls.forEach(([control, disabled]) => { control.disabled = disabled; });
            if (button) button.textContent = label;
            busy = false;
        }
    }
    function field(label, name, value = '', type = 'text', maximum = 120, required = true) {
        return `<label>${label}<input name="${name}" type="${type}" value="${escape(value)}" maxlength="${maximum}" ${required ? 'required' : ''}></label>`;
    }
    function open(action, personId) {
        if (!user?.admin || busy || !current()) return;
        const activity = current(); const person = activity.participants?.[personId];
        if (action.includes('person') && action !== 'add-person' && !person) return;
        context = { action, id: activity.id, personId };
        const deleting = action === 'delete' || action === 'delete-person';
        find('#activity-editor-title').textContent = ({ edit: 'Editar actividad', delete: 'Eliminar actividad', 'add-person': 'Registrar entrega', 'edit-person': 'Editar persona', 'delete-person': 'Quitar persona' })[action];
        find('[data-activity-editor-copy]').textContent = action === 'delete' ? `Se eliminará «${activity.title}» con todas sus entregas y estados de pago. Esta acción no se puede deshacer.` : action === 'delete-person' ? `Se quitará a ${person.name} de «${activity.title}», incluyendo su estado de pago. No cambia su cuenta ni las demás listas.` : action === 'edit' ? 'Actualiza el nombre o la fecha. Las entregas y los pagos se conservan.' : `Registra la entrega en «${activity.title}». Puedes indicar los números de rifa u otro detalle.`;
        find('[data-activity-editor-fields]').innerHTML = deleting ? '' : action === 'edit' ? field('Nombre de la actividad', 'title', activity.title) + field('Fecha (opcional)', 'date', activity.date, 'date', 10, false) : field('Nombre de la persona', 'name', person?.name) + field('Detalle de la entrega (opcional)', 'detail', person?.detail, 'text', 160, false);
        const button = find('[data-activity-save]');
        button.textContent = deleting ? 'Sí, eliminar' : action === 'add-person' ? 'Registrar entrega →' : 'Guardar cambios →';
        button.classList.toggle('attendance-delete-session', deleting);
        modal.classList.add('open');
        (deleting ? find('[data-activity-close]') : find('[data-activity-editor-fields] input'))?.focus();
    }
    root.addEventListener('click', event => {
        if (event.target.closest('[data-activity-close]') || event.target === modal) { close(); return; }
        const button = event.target.closest('[data-activity-action]');
        if (!button || busy || button.disabled) return;
        const action = button.dataset.activityAction;
        if (action === 'retry') { controller.setUser(user); return; }
        if (action === 'newer' || action === 'older') { page += action === 'newer' ? -1 : 1; render(); return; }
        open(action, button.dataset.person);
    });
    root.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    find('#activity-create-form').addEventListener('submit', event => {
        event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
        save(form, () => createActivity(values), id => { form.reset(); focusId = id; page = Math.max(0, activities.findIndex(activity => activity.id === id)); render(); toast('Actividad creada.'); });
    });
    editor.addEventListener('submit', event => {
        event.preventDefault(); if (!context) return;
        const { action, id, personId } = context;
        const values = Object.fromEntries(new FormData(editor));
        const actions = {
            edit: () => updateActivity(id, values), delete: () => deleteActivity(id),
            'add-person': () => addActivityParticipant(id, values),
            'edit-person': () => updateActivityParticipant(id, personId, values),
            'delete-person': () => removeActivityParticipant(id, personId),
        };
        save(editor, actions[action], () => { close(true); toast(action.startsWith('delete') ? 'Registro eliminado.' : 'Cambios guardados.'); });
    });
    root.addEventListener('change', async event => {
        const select = event.target.closest('[data-activity-payment]');
        if (!select || !user?.admin || !current()) return;
        if (busy) { render(); return; }
        const id = current().id, personId = select.dataset.person, status = select.value;
        select.disabled = true; busy = true; const version = generation;
        try { await setActivityPayment(id, personId, status); if (version === generation) toast(status === 'paid' ? 'Pago registrado.' : 'Pago marcado como pendiente.'); }
        catch (failure) { if (version === generation) { toast(`No fue posible actualizar el pago: ${failure.message}`); render(); } }
        finally { select.disabled = false; busy = false; }
    });
    const controller = {
        setUser(nextUser) {
            generation += 1; unsubscribe?.(); unsubscribe = null; close(true);
            user = nextUser; activities = []; page = 0; focusId = null; error = ''; loading = Boolean(user); render();
            if (!user) return;
            const version = generation;
            unsubscribe = watchActivities(value => {
                if (version !== generation) return;
                const selected = focusId || current()?.id;
                activities = value;
                if (selected) { const index = activities.findIndex(activity => activity.id === selected); if (index >= 0) { page = index; focusId = null; } }
                loading = false; error = ''; render();
            }, failure => { if (version === generation) { loading = false; error = failure.message; render(); } });
        },
    };
    return controller;
}

import { requestPasswordReset } from './password-reset.js';

const nextRequestAt = new Map();

export function bindPasswordResetForm(form, feedback) {
    const field = form?.elements?.email;
    const button = form?.querySelector('[type="submit"]');
    if (!form || !feedback || !field || !button || form.dataset.passwordResetBound === 'true') return;
    form.dataset.passwordResetBound = 'true';

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (form.dataset.sending === 'true') return;
        const email = field.value.trim();
        field.value = email;
        if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

        feedback.hidden = false;
        feedback.dataset.state = '';
        feedback.setAttribute('role', 'status');
        const key = email.toLowerCase();
        if (Date.now() < (nextRequestAt.get(key) || 0)) {
            feedback.textContent = 'Espera un minuto entre solicitudes al mismo correo. Revisa también tu carpeta de spam.';
            return;
        }

        const label = button.textContent;
        const wasFieldDisabled = field.disabled;
        const wasButtonDisabled = button.disabled;
        form.dataset.sending = 'true';
        form.setAttribute('aria-busy', 'true');
        field.disabled = true;
        button.disabled = true;
        button.textContent = 'Enviando…';
        feedback.textContent = 'Solicitando el enlace de recuperación…';

        try {
            await requestPasswordReset(email);
            nextRequestAt.set(key, Date.now() + 60_000);
            feedback.textContent = 'Si este correo está registrado, recibirás un enlace para cambiar tu contraseña. Revisa tu bandeja de entrada y la carpeta de spam.';
        } catch (error) {
            feedback.dataset.state = 'error';
            feedback.setAttribute('role', 'alert');
            feedback.textContent = error?.message || 'No fue posible solicitar el enlace. Intenta nuevamente.';
        } finally {
            delete form.dataset.sending;
            form.setAttribute('aria-busy', 'false');
            field.disabled = wasFieldDisabled;
            button.disabled = wasButtonDisabled;
            button.textContent = label;
        }
    });
}

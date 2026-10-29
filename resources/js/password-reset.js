import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase.js';

export async function requestPasswordReset(email) {
    const address = typeof email === 'string' ? email.trim() : '';
    if (!address || !/^[^\s@]+@[^\s@]+$/.test(address)) {
        throw new Error('Escribe un correo electrónico válido.');
    }
    if (!auth) throw new Error('La recuperación de contraseña no está disponible en este momento.');

    auth.languageCode = 'es';
    try {
        await sendPasswordResetEmail(auth, address);
    } catch (error) {
        // Use the same confirmation for unknown addresses and registered accounts.
        if (error.code === 'auth/user-not-found') return;
        const messages = {
            'auth/invalid-email': 'Escribe un correo electrónico válido.',
            'auth/too-many-requests': 'Se hicieron demasiadas solicitudes. Espera unos minutos antes de intentarlo otra vez.',
            'auth/network-request-failed': 'No se pudo conectar. Revisa tu conexión e intenta nuevamente.',
        };
        throw new Error(messages[error.code] || 'No fue posible solicitar el enlace. Intenta nuevamente más tarde.');
    }
}

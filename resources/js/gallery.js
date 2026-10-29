const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

export function galleryCardHtml(item) {
    const media = item.mediaUrl ? (/\.(mp4|webm|mov)(\?|$)/i.test(item.mediaUrl) ? `<video controls src="${escapeHtml(item.mediaUrl)}"></video>` : `<img src="${escapeHtml(item.mediaUrl)}" alt="${escapeHtml(item.caption)}">`) : '';
    const postId = escapeHtml(item.id);
    return `${media}<div class="gallery-caption"><span>${escapeHtml(item.caption || 'PUBLICACIÓN DRAGONS')}</span><button type="button" class="like" data-like data-gallery-like data-post-id="${postId}" data-liked="false" aria-pressed="false" aria-label="Dar me gusta"><span data-like-icon aria-hidden="true">♡</span> <b data-like-count hidden>0</b></button></div>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}<div class="photo-comments"><div data-comment-list="${postId}"></div><form data-inline-comment data-post-id="${postId}"><textarea name="body" required maxlength="2000" rows="1" aria-label="Comentario de la publicación" placeholder="Escribe un comentario..."></textarea><button class="comment-send" type="submit">Comentar</button></form></div>`;
}

export function galleryCommentHtml(item) {
    return `<p>${escapeHtml(item.body)}</p>`;
}

export function aggregateGalleryLikes(likes, userId) {
    const counts = new Map();
    const liked = new Set();
    const seen = new Set();
    for (const like of likes) {
        if (typeof like.postId !== 'string' || !like.postId || typeof like.userId !== 'string' || !like.userId) continue;
        const key = JSON.stringify([like.postId, like.userId]);
        if (seen.has(key)) continue;
        seen.add(key);
        counts.set(like.postId, (counts.get(like.postId) || 0) + 1);
        if (like.userId === userId) liked.add(like.postId);
    }
    return { counts, liked };
}

export function updateGalleryLikeButton(button, { count = 0, liked = false, likesAvailable = false } = {}) {
    button.dataset.liked = String(liked);
    button.setAttribute('aria-pressed', String(liked));
    button.setAttribute('aria-label', liked ? 'Ya te gusta esta publicación' : 'Dar me gusta');
    button.querySelector('[data-like-icon]').textContent = liked ? '♥' : '♡';
    const counter = button.querySelector('[data-like-count]');
    counter.textContent = String(count);
    counter.hidden = !likesAvailable;
}

export function resizeGalleryTextarea(textarea) {
    if (!textarea?.style) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

export function bindGalleryInteractions(root, { getUser, addLike, addComment, onLike = () => {}, onComment = () => {}, onError = () => {} }) {
    if (!root || root.dataset.galleryBound === 'true') return;
    root.dataset.galleryBound = 'true';

    root.addEventListener('click', async event => {
        const button = event.target.closest('[data-gallery-like]');
        if (!button || !root.contains(button) || button.dataset.saving === 'true') return;
        const user = getUser();
        if (!user?.uid) return onError('Inicia sesión para dar like.');
        if (button.dataset.liked === 'true') return onError('Ya diste like a esta publicación.');
        button.dataset.saving = 'true';
        button.disabled = true;
        try {
            const result = await addLike(user, button.dataset.postId);
            const count = Number(button.querySelector('[data-like-count]').textContent) || 0;
            updateGalleryLikeButton(button, { count: count + (result.added ? 1 : 0), liked: true, likesAvailable: true });
            await onLike(button.dataset.postId, result);
        } catch (error) { onError(error.message || 'No fue posible guardar el like.'); }
        finally { delete button.dataset.saving; button.disabled = false; }
    });

    root.addEventListener('submit', async event => {
        const form = event.target.closest('[data-inline-comment]');
        if (!form || !root.contains(form)) return;
        event.preventDefault();
        if (form.dataset.sending === 'true') return;
        const user = getUser();
        if (!user?.uid) return onError('Inicia sesión para comentar.');
        const body = form.elements.body.value.trim();
        if (!body) return onError('Escribe un comentario antes de publicarlo.');
        const button = form.querySelector('[type="submit"]');
        form.dataset.sending = 'true';
        button.disabled = true;
        try {
            await addComment(user, body, form.dataset.postId);
            form.reset(); resizeGalleryTextarea(form.elements.body);
            await onComment(form.dataset.postId);
        } catch (error) { onError(error.message || 'No fue posible publicar el comentario.'); }
        finally { delete form.dataset.sending; button.disabled = false; }
    });

    root.addEventListener('input', event => {
        if (event.target.matches('[data-inline-comment] textarea')) resizeGalleryTextarea(event.target);
    });
}

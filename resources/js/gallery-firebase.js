import { addDoc, collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import { db } from './firebase.js';
import { aggregateGalleryLikes } from './gallery.js';

function postIdValue(value) {
    if (typeof value !== 'string' || !value.trim() || value.includes('/')) throw new Error('La publicación no es válida.');
    return value;
}

export async function addLike(user, postId) {
    if (!user?.uid) throw new Error('Inicia sesión para dar like.');
    const id = postIdValue(postId);
    const likeRef = doc(db, 'galleryLikes', `${id}_${user.uid}`);
    const createdAt = new Date().toISOString();
    return runTransaction(db, async transaction => {
        const existing = await transaction.get(likeRef);
        if (existing.exists()) return { added: false };
        transaction.set(likeRef, { postId: id, userId: user.uid, createdAt });
        return { added: true };
    });
}

export async function addComment(user, body, postId = 'general') {
    if (!user?.uid) throw new Error('Inicia sesión para comentar.');
    const cleanBody = typeof body === 'string' ? body.trim() : '';
    if (!cleanBody || cleanBody.length > 2000) throw new Error('Escribe un comentario de entre 1 y 2000 caracteres.');
    await addDoc(collection(db, 'galleryComments'), { userId: user.uid, body: cleanBody, postId: postIdValue(postId), createdAt: new Date().toISOString() });
}

export async function loadGalleryEngagement(user = null) {
    const [commentSnapshot, likeSnapshot] = await Promise.all([
        getDocs(collection(db, 'galleryComments')),
        user?.uid ? getDocs(collection(db, 'galleryLikes')) : Promise.resolve(null),
    ]);
    const comments = commentSnapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((first, second) => String(second.createdAt || '').localeCompare(String(first.createdAt || '')));
    const likes = likeSnapshot?.docs.map(item => item.data()) || [];
    return { comments, ...aggregateGalleryLikes(likes, user?.uid), likesAvailable: Boolean(likeSnapshot) };
}

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, reload, sendEmailVerification, signInWithEmailAndPassword, signOut, updateEmail, updatePassword, updateProfile } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, onSnapshot, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { markPendingRecordsAbsent } from './attendance';
import { publicAttendanceSession } from './attendance-privacy';
import { attendancePlayersForSession, listManualRosterPlayers } from './roster';
import { validateCompetitionImage } from './media-validation';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);
export const app = firebaseEnabled ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
export const functions = app ? getFunctions(app) : null;

export async function signInClub(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getDoc(doc(db, 'users', credential.user.uid));
    return { user: credential.user, profile: profile.exists() ? profile.data() : { role: 'guest', name: credential.user.displayName || email } };
}

export function watchClubSession(callback) {
    return onAuthStateChanged(auth, async user => {
        if (!user) return callback(null);
        const profile = await getDoc(doc(db, 'users', user.uid));
        callback({ user, profile: profile.exists() ? profile.data() : { role: 'guest', name: user.displayName || user.email } });
    });
}

export async function signOutClub() {
    await signOut(auth);
}

export async function registerGuest(name, email, password) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', credential.user.uid), { name, email, role: 'guest', createdAt: new Date().toISOString() });
    await sendEmailVerification(credential.user);
}

export async function submitEventQuestion(name, question) {
    await addDoc(collection(db, 'eventQuestions'), { name, question, status: 'new', createdAt: new Date().toISOString() });
}

export async function addLike(user, postId) {
    const likeRef = doc(db, 'galleryLikes', `${postId}_${user.uid}`);
    if ((await getDoc(likeRef)).exists()) return { added: false };
    await setDoc(likeRef, { postId, userId: user.uid, createdAt: new Date().toISOString() });
    return { added: true };
}

export async function requestSavingsToken(user) {
    await addDoc(collection(db, 'savingsAccessRequests'), { userId: user.uid, phone: user.phoneNumber || null, createdAt: new Date().toISOString(), status: 'pending' });
}

export async function requestSavingsEmailLink(user) {
    await reload(user);
    if (user.emailVerified) {
        await user.getIdToken(true);
        return true;
    }
    await sendEmailVerification(user);
    return false;
}

export async function createPlayerInvite(player) {
    await addDoc(collection(db, 'playerInvites'), { ...player, role: 'player', status: 'pending', createdAt: new Date().toISOString() });
}

export async function createPlayer(player) {
    const result = await httpsCallable(functions, 'createPlayer')(player);
    return result.data;
}

export async function updatePlayer(player) {
    const result = await httpsCallable(functions, 'updatePlayer')(player);
    return result.data;
}

export async function deletePlayer(uid) {
    const result = await httpsCallable(functions, 'deletePlayer')({ uid });
    return result.data;
}

export async function publishNotice(notice) {
    await addDoc(collection(db, 'communications'), { ...notice, createdAt: new Date().toISOString() });
}

export async function addAgendaItem(item) {
    await addDoc(collection(db, 'agendaItems'), { ...item, createdAt: new Date().toISOString() });
}

export async function addPastCompetition(competition) {
    await addDoc(collection(db, 'pastCompetitions'), { ...competition, createdAt: new Date().toISOString() });
}

export async function updateCompetition(competition) {
    await setDoc(doc(db, 'clubContent', 'competition'), { ...competition, updatedAt: new Date().toISOString() });
}

export async function uploadCompetitionImage(file) {
    validateCompetitionImage(file);
    const imageRef = ref(storage, `competitions/current-${Date.now()}-${file.name}`);
    await uploadBytes(imageRef, file);
    return getDownloadURL(imageRef);
}

export async function uploadProfileImage(user, file) {
    const imageRef = ref(storage, `profile-images/${user.uid}/${Date.now()}-${file.name}`);
    await uploadBytes(imageRef, file);
    const avatarUrl = await getDownloadURL(imageRef);
    await updateDoc(doc(db, 'users', user.uid), { avatarUrl });
    return avatarUrl;
}

export async function updateOwnProfile(user, values) {
    if (values.name) await updateProfile(user, { displayName: values.name });
    if (values.email && values.email !== user.email) await updateEmail(user, values.email);
    await setDoc(doc(db, 'users', user.uid), { ...(values.name ? { name: values.name } : {}), ...(values.email ? { email: values.email } : {}) }, { merge: true });
}

export async function updateOwnPassword(user, password) { await updatePassword(user, password); }

export async function uploadGalleryMedia(user, file, caption, description = '') {
    const mediaRef = ref(storage, `gallery/${Date.now()}-${file.name}`);
    await uploadBytes(mediaRef, file);
    const mediaUrl = await getDownloadURL(mediaRef);
    await addDoc(collection(db, 'galleryPosts'), { mediaUrl, caption, description, createdBy: user.uid, createdAt: new Date().toISOString() });
    return mediaUrl;
}

export async function addComment(user, body, postId = 'general') {
    await addDoc(collection(db, 'galleryComments'), { userId: user.uid, body, postId, createdAt: new Date().toISOString() });
}

export async function loadPublicClubData() {
    const [agendaSnapshot, competitionSnapshot, settingsSnapshot, gallerySnapshot, pastCompetitionsSnapshot] = await Promise.all([
        getDocs(collection(db, 'agendaItems')),
        getDoc(doc(db, 'clubContent', 'competition')),
        getDoc(doc(db, 'clubContent', 'settings')),
        getDocs(collection(db, 'galleryPosts')),
        getDocs(collection(db, 'pastCompetitions')),
    ]);
    return { agenda: agendaSnapshot.docs.map(item => ({ id: item.id, ...item.data() })), competition: competitionSnapshot.exists() ? competitionSnapshot.data() : null, settings: settingsSnapshot.exists() ? settingsSnapshot.data() : null, gallery: gallerySnapshot.docs.map(item => ({ id: item.id, ...item.data() })), pastCompetitions: pastCompetitionsSnapshot.docs.map(item => ({ id: item.id, ...item.data() })) };
}

export async function loadMemberNotices() {
    const snapshot = await getDocs(collection(db, 'communications'));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function loadGalleryComments() {
    const snapshot = await getDocs(collection(db, 'galleryComments'));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function loadClubUsers() {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function loadRosterPlayers() {
    const snapshot = await getDocs(collection(db, 'rosterPlayers'));
    return listManualRosterPlayers(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
}

export async function addRosterPlayer(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Escribe el nombre del atleta.');
    if (!auth?.currentUser) throw new Error('Inicia sesión como entrenador.');
    await addDoc(collection(db, 'rosterPlayers'), { name: cleanName, source: 'manual', createdBy: auth.currentUser.uid, createdAt: new Date().toISOString() });
}

export async function updateRosterPlayer(id, name) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length > 120) throw new Error('Escribe un nombre de entre 1 y 120 caracteres.');
    await updateDoc(doc(db, 'rosterPlayers', id), { name: cleanName });
}

export async function deleteRosterPlayer(id) {
    await updateDoc(doc(db, 'rosterPlayers', id), { archived: true, archivedAt: new Date().toISOString() });
}

export async function loadAttendanceSessions({ admin = false } = {}) {
    const snapshot = await getDocs(collection(db, admin ? 'attendance' : 'attendancePublic'));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export function watchAttendanceSessions(callback, onError = () => {}, { admin = false } = {}) {
    return onSnapshot(collection(db, admin ? 'attendance' : 'attendancePublic'), snapshot => {
        callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))));
    }, onError);
}

export async function createAttendanceSession(date) {
    const sessionRef = doc(collection(db, 'attendance'));
    const session = { date, records: {}, createdAt: new Date().toISOString() };
    await runTransaction(db, async transaction => {
        transaction.set(sessionRef, session);
        transaction.set(doc(db, 'attendancePublic', sessionRef.id), publicAttendanceSession(session));
    });
}

export async function saveAttendanceRecord(sessionId, userId, values) {
    const sessionRef = doc(db, 'attendance', sessionId);
    await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(sessionRef);
        if (!snapshot.exists()) throw new Error('La lista de asistencia ya no existe.');
        const session = snapshot.data();
        if (session.excludedPlayerIds?.includes(userId)) throw new Error('El jugador ya fue retirado de esta lista.');
        const records = { ...(session.records || {}), [userId]: values };
        transaction.update(sessionRef, { records });
        transaction.set(doc(db, 'attendancePublic', sessionId), publicAttendanceSession({ ...session, records }));
    });
}

export async function markPendingAttendanceAbsent(sessionId, playerIds) {
    const sessionRef = doc(db, 'attendance', sessionId);
    return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(sessionRef);
        if (!snapshot.exists()) throw new Error('La lista de asistencia ya no existe.');

        // Recheck the latest records on every retry so concurrent edits are preserved.
        const session = snapshot.data();
        const result = markPendingRecordsAbsent(session.records || {}, attendancePlayersForSession(session, playerIds));
        if (result.updatedCount) {
            transaction.update(sessionRef, { records: result.records });
            transaction.set(doc(db, 'attendancePublic', sessionId), publicAttendanceSession({ ...session, records: result.records }));
        }
        return result.updatedCount;
    });
}

export async function publishAttendanceSummaries() {
    const snapshot = await getDocs(collection(db, 'attendance'));
    // Existing private records stay intact; publish only the allowed fields for athletes.
    for (const item of snapshot.docs) {
        await runTransaction(db, async transaction => {
            const sessionRef = doc(db, 'attendance', item.id);
            const publicRef = doc(db, 'attendancePublic', item.id);
            const [current, published] = await Promise.all([transaction.get(sessionRef), transaction.get(publicRef)]);
            if (!current.exists()) return;
            const summary = publicAttendanceSession(current.data());
            if (!published.exists() || JSON.stringify(published.data()) !== JSON.stringify(summary)) {
                transaction.set(publicRef, summary);
            }
        });
    }
}

export async function saveClubSettings(settings) { await setDoc(doc(db, 'clubContent', 'settings'), settings, { merge: true }); }
export async function loadSavings() { const snapshot = await getDoc(doc(db, 'savings', 'current')); return snapshot.exists() ? snapshot.data() : null; }
export async function updateClubRecord(collectionName, id, values) { await updateDoc(doc(db, collectionName, id), values); }
export async function deleteClubRecord(collectionName, id) { await deleteDoc(doc(db, collectionName, id)); }

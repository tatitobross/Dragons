import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';
import { listManualRosterPlayers } from './roster.js';

export function watchRosterPlayers(callback, onError = () => {}) {
    return onSnapshot(collection(db, 'rosterPlayers'), snapshot => {
        callback(listManualRosterPlayers(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))));
    }, onError);
}

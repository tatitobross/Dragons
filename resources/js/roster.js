export function getRosterPlayerIds(player) {
    return [...new Set([player.id, ...(player.aliasIds || []), player.userId].filter(id => typeof id === 'string' && id))];
}

export function resolveRosterAttendanceRecord(records = {}, player) {
    const ids = getRosterPlayerIds(player);
    const recordedId = ids.find(id => records[id]?.status) || ids.find(id => Object.hasOwn(records, id)) || player.id;
    return { playerId: recordedId, record: records[recordedId] || {} };
}

export function isManualRosterPlayer(player) {
    if (!player || player.archived || player.mergedInto) return false;
    if (player.source === 'account') return false;
    if (player.source === 'manual') return true;
    // Legacy automatic entries used the account UID as the roster document ID.
    // Keep pre-existing coach entries and their historical aliases intact.
    return !player.userId || player.id !== player.userId;
}

export function listManualRosterPlayers(players = []) {
    return players.filter(isManualRosterPlayer).sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'es'));
}

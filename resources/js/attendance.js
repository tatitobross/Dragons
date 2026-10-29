import { resolveRosterAttendanceRecord } from './roster.js';

export function getPendingAttendancePlayerIds(records = {}, playerIds = []) {
    const resolvedIds = playerIds.map(player => typeof player === 'string' ? player : resolveRosterAttendanceRecord(records, player).playerId);
    return [...new Set(resolvedIds)].filter(playerId => !records[playerId]?.status);
}

export function markPendingRecordsAbsent(records = {}, playerIds = []) {
    const pendingPlayerIds = getPendingAttendancePlayerIds(records, playerIds);
    const updatedRecords = { ...records };

    for (const playerId of pendingPlayerIds) {
        updatedRecords[playerId] = { status: 'falto' };
    }

    return { records: updatedRecords, updatedCount: pendingPlayerIds.length };
}

import { resolveRosterAttendanceRecord } from './roster.js';

export function attendanceSessionTitle(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
        throw new Error('Escribe un nombre de entre 1 y 120 caracteres.');
    }
    return value.trim();
}

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

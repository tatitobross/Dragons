export function publicAttendanceSession(session) {
    const excludedPlayerIds = Array.isArray(session.excludedPlayerIds) ? session.excludedPlayerIds.filter(id => typeof id === 'string') : [];
    const records = Object.fromEntries(Object.entries(session.records || {}).filter(([id]) => !excludedPlayerIds.includes(id)).map(([playerId, record]) => {
        const status = ['asistio', 'falto'].includes(record?.status) ? record.status : '';
        return [playerId, {
            status,
            ...(status === 'asistio' ? { paymentStatus: ['pago', 'debe'].includes(record.paymentStatus) ? record.paymentStatus : '' } : {}),
        }];
    }));

    return { date: session.date || '', createdAt: session.createdAt || '', ...(excludedPlayerIds.length ? { excludedPlayerIds } : {}), records };
}

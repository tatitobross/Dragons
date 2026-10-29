export function publicAttendanceSession(session) {
    const records = Object.fromEntries(Object.entries(session.records || {}).map(([playerId, record]) => {
        const status = ['asistio', 'falto'].includes(record?.status) ? record.status : '';
        return [playerId, {
            status,
            ...(status === 'asistio' ? { paymentStatus: ['pago', 'debe'].includes(record.paymentStatus) ? record.paymentStatus : '' } : {}),
        }];
    }));

    return { date: session.date || '', createdAt: session.createdAt || '', ...(typeof session.title === 'string' && session.title.trim() ? { title: session.title.trim() } : {}), records };
}

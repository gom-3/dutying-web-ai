export function formatShiftDuration(startTime: string, endTime: string) {
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    if (start === null || end === null) return '-';

    let diff = end - start;

    if (diff <= 0) diff += 24 * 60;

    const hours = diff / 60;

    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1).replace(/\.0$/, '')}h`;
}

function parseTime(value: string) {
    const [hour, minute] = value.split(':').map(Number);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;

    return hour * 60 + minute;
}

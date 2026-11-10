// Keep the saved layout intact in both guest and management maps.
export function normalizeBookingLayout(data) {
  return {...data, objects:(data?.objects||[]).map(o=>({...o,
    position:[...o.position],rotation:[...o.rotation],scale:[...o.scale]
  }))};
}

// Date-only arithmetic avoids local timezone/DST shifts for weekly recurrence.
export function weeklyOccurrences(firstDay, lastDay, maxOccurrences = 52) {
  const valid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  if (!valid(firstDay) || !valid(lastDay) || lastDay < firstDay) {
    throw new Error('Ngày kết thúc lặp lại phải bằng hoặc sau ngày đầu tiên.');
  }
  const start = Date.parse(firstDay + 'T00:00:00Z');
  const end = Date.parse(lastDay + 'T00:00:00Z');
  const out = [];
  for (let stamp = start; stamp <= end; stamp += 7 * 86400000) {
    out.push(new Date(stamp).toISOString().slice(0, 10));
    if (out.length > maxOccurrences) {
      throw new Error(`Một chuỗi đặt lặp tối đa ${maxOccurrences} lần. Hãy chọn ngày kết thúc gần hơn.`);
    }
  }
  return out;
}

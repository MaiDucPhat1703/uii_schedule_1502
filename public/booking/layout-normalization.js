// Keep the six bookable chairs evenly spaced around each hexagonal table in the booking view.
// This only normalizes the public booking-map coordinates; it never overwrites the saved admin layout.
export function normalizeBookingLayout(data, radius = 1.12) {
  const objects = (data?.objects || []).map((o) => ({
    ...o,
    position: Array.isArray(o.position) ? [...o.position] : o.position,
  }));
  const byId = new Map(objects.map((o) => [o.id, o]));
  const isChair = (o) => /^chair-\d+$/.test(o.source || o.id);
  const meeting = byId.get('added-a6fb9fd3-3fc2-4d1c-8aba-ae85531a4c94');
  const chairs = objects.filter((o) => isChair(o) && o.bookable && Array.isArray(o.position));
  const assigned = new Set();

  const arrange = (table, members) => {
    if (!table || members.length !== 6) return;
    const base = Number(table.rotation?.[1] || 0);
    members.sort((a, b) => {
      const na = Number((a.source || a.id).match(/chair-(\d+)$/)?.[1] || 0);
      const nb = Number((b.source || b.id).match(/chair-(\d+)$/)?.[1] || 0);
      return na - nb || String(a.id).localeCompare(String(b.id));
    });
    members.forEach((chair, index) => {
      const angle = base + index * Math.PI / 3;
      chair.position[0] = table.position[0] + Math.sin(angle) * radius;
      chair.position[2] = table.position[2] + Math.cos(angle) * radius;
      assigned.add(chair.id);
    });
  };

  // The enclosed six-seat meeting table is a separate bookable resource.
  if (meeting && Array.isArray(meeting.position)) {
    const group = chairs.filter((chair) =>
      Math.hypot(chair.position[0] - meeting.position[0], chair.position[2] - meeting.position[2]) < 2
    );
    arrange(meeting, group);
  }

  const tables = objects.filter((o) =>
    o.id !== meeting?.id && /^hex-\d+$/.test(o.source || o.id) && Array.isArray(o.position)
  );
  for (const table of tables) {
    const members = chairs.filter((chair) => {
      if (assigned.has(chair.id)) return false;
      const nearest = tables
        .map((candidate) => ({
          candidate,
          distance: Math.hypot(chair.position[0] - candidate.position[0], chair.position[2] - candidate.position[2]),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      return nearest?.candidate.id === table.id && nearest.distance < 2;
    });
    arrange(table, members);
  }

  return { ...data, objects };
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

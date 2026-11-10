// Display date-only values without timezone conversion. API and input values stay ISO.
export function formatDay(value){
 const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
 return match?`${match[3]}/${match[2]}/${match[1]}`:value||'—';
}
export function formatDateTime(value){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return '—';
 const parts=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const get=type=>parts.find(p=>p.type===type)?.value;
 return `${get('day')}/${get('month')}/${get('year')} · ${get('hour')}:${get('minute')}`;
}

export const formatDateText=value=>String(value).replace(/\b\d{4}-\d{2}-\d{2}\b/g,formatDay);

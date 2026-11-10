var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// supabase/edge-entry.ts
import postgres from "npm:postgres@3.4.7";

// app/runtime.ts
import { AsyncLocalStorage } from "node:async_hooks";
var context = new AsyncLocalStorage();
var env = new Proxy({}, { get: (_, key2) => context.getStore()?.[key2], set: (_, key2, value) => {
  const state = context.getStore();
  if (!state) throw Error("Missing request context");
  state[key2] = value;
  return true;
} });

// app/postgres-adapter.ts
function postgresSQL(source2) {
  let sql2 = source2.replace(/`([^`]+)`/g, '"$1"').replace(/\bIS\s+\?/g, "IS NOT DISTINCT FROM ?");
  sql2 = sql2.replace(/json_array\(([^()]+)\)/g, "jsonb_build_array($1)::text");
  let pos = 0;
  while ((pos = sql2.indexOf("json_each(", pos)) !== -1) {
    let i = pos + 10, depth = 1, quote = false;
    for (; i < sql2.length; i++) {
      if (sql2[i] === "'") {
        if (quote && sql2[i + 1] === "'") {
          i++;
          continue;
        }
        quote = !quote;
      }
      if (!quote) {
        if (sql2[i] === "(") depth++;
        if (sql2[i] === ")" && --depth === 0) break;
      }
    }
    const expression = sql2.slice(pos + 10, i);
    const replacement = "jsonb_array_elements_text((" + expression + ")::text::jsonb)";
    sql2 = sql2.slice(0, pos) + replacement + sql2.slice(i + 1);
    pos += replacement.length;
  }
  sql2 = sql2.replace(/\)\s+(startMinute|endMinute)\b/g, ') AS "$1"');
  let n = 0, quoted = false, result = "";
  for (let i = 0; i < sql2.length; i++) {
    const c = sql2[i];
    if (c === "'") {
      if (quoted && sql2[i + 1] === "'") {
        result += "''";
        i++;
        continue;
      }
      quoted = !quoted;
    }
    result += c === "?" && !quoted ? "$" + ++n : c;
  }
  return result;
}
function database(client) {
  class Statement {
    constructor(source2) {
      this.source = source2;
    }
    args = [];
    bind(...args) {
      this.args = args;
      return this;
    }
    async all() {
      const rows = await client.unsafe(postgresSQL(this.source), this.args);
      return { results: Array.from(rows), meta: { changes: rows.count ?? rows.length } };
    }
    async first() {
      return (await this.all()).results[0] ?? null;
    }
    async run() {
      return this.all();
    }
  }
  return { prepare: (sql2) => new Statement(sql2), batch: async (items) => {
    const results = [];
    for (const item of items) results.push(await item.all());
    return results;
  } };
}

// app/api/admin/auth/route.ts
var route_exports = {};
__export(route_exports, {
  GET: () => GET,
  POST: () => POST
});

// app/admin-auth.ts
var encoder = new TextEncoder();
var to64 = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var from64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function key() {
  return crypto.subtle.importKey("raw", encoder.encode(env.VISITOR_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(p) {
  const body = to64(encoder.encode(JSON.stringify(p)));
  return body + "." + to64(new Uint8Array(await crypto.subtle.sign("HMAC", await key(), encoder.encode(body))));
}
async function visitor(r) {
  const token = r.headers.get("x-visitor-token");
  if (token && token.length <= 2048) try {
    const [body, sig, ...extra] = token.split(".");
    if (!extra.length && await crypto.subtle.verify("HMAC", await key(), from64(sig), encoder.encode(body))) {
      const p = JSON.parse(new TextDecoder().decode(from64(body)));
      if (p.purpose === "visitor" && p.exp > Date.now() && typeof p.id === "string") return { userId: "visitor:" + p.id, cookie: null };
    }
  } catch {
  }
  const id = crypto.randomUUID(), value = await sign({ purpose: "visitor", id, exp: Date.now() + 90 * 864e5 });
  env.visitorToken = value;
  return { userId: "visitor:" + id, cookie: null };
}
async function getAdmin(r) {
  if (env.adminChecked) return env.admin ?? null;
  env.adminChecked = true;
  const bearer = r.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ") || bearer.length > 8192) return null;
  const response2 = await fetch(env.SUPABASE_URL + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: bearer }, signal: AbortSignal.timeout(1e4), redirect: "error", credentials: "omit" });
  if (!response2.ok) return null;
  const user = await response2.json();
  if (typeof user.id !== "string") return null;
  const row = await env.DB.prepare("SELECT user_id FROM admin_users WHERE user_id=?").bind(user.id).first();
  env.admin = row ? { userId: user.id, username: user.email } : null;
  return env.admin;
}
function sameOrigin(r) {
  return r.headers.get("origin") === env.ALLOWED_ORIGIN;
}

// app/api/admin/auth/route.ts
var json = (b, s = 200) => Response.json(b, { status: s });
async function auth(path, body, token, method = "POST") {
  return fetch(env.SUPABASE_URL + "/auth/v1/" + path, { method, headers: { apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json", ...token ? { Authorization: token } : {} }, body: JSON.stringify(body), signal: AbortSignal.timeout(1e4), redirect: "error", credentials: "omit" });
}
async function GET(r) {
  const user = await getAdmin(r);
  return json({ authenticated: !!user, username: user?.username });
}
async function POST(r) {
  if (!sameOrigin(r)) return json({ error: "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7." }, 403);
  let b;
  try {
    b = await r.json();
  } catch {
    return json({ error: "D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  }
  if (!b || typeof b !== "object" || Array.isArray(b)) return json({ error: "D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  if (b.action === "logout") {
    const token = r.headers.get("authorization");
    if (token) await auth("logout", {}, token);
    return json({ ok: true, clearSession: true });
  }
  if (b.action === "password") {
    const admin2 = await getAdmin(r);
    if (!admin2) return json({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp admin." }, 401);
    if (typeof b.newPassword !== "string" || b.newPassword.length < 12 || b.newPassword.length > 200 || typeof b.currentPassword !== "string") return json({ error: "M\u1EADt kh\u1EA9u m\u1EDBi c\u1EA7n t\u1EEB 12 \u0111\u1EBFn 200 k\xFD t\u1EF1." }, 400);
    const verified = await auth("token?grant_type=password", { email: admin2.username, password: b.currentPassword });
    if (!verified.ok) return json({ error: "M\u1EADt kh\u1EA9u hi\u1EC7n t\u1EA1i kh\xF4ng \u0111\xFAng." }, 403);
    const changed = await auth("user", { password: b.newPassword }, r.headers.get("authorization"), "PUT");
    if (!changed.ok) return json({ error: "Ch\u01B0a \u0111\u1ED5i \u0111\u01B0\u1EE3c m\u1EADt kh\u1EA9u." }, 400);
    await auth("logout", {}, r.headers.get("authorization"));
    return json({ ok: true, clearSession: true });
  }
  if (typeof b.username !== "string" || typeof b.password !== "string" || b.username.length > 255 || b.password.length > 200) return json({ error: "Nh\u1EADp email v\xE0 m\u1EADt kh\u1EA9u admin." }, 400);
  const result = await auth("token?grant_type=password", { email: b.username.trim(), password: b.password });
  if (!result.ok) return json({ error: "Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng \u0111\xFAng, ho\u1EB7c t\xE0i kho\u1EA3n ch\u01B0a \u0111\u01B0\u1EE3c x\xE1c nh\u1EADn." }, 401);
  const session = await result.json();
  const check = new Request(r.url, { headers: new Headers(r.headers) });
  check.headers.set("authorization", "Bearer " + session.access_token);
  env.adminChecked = false;
  const admin = await getAdmin(check);
  if (!admin) {
    await auth("logout", {}, "Bearer " + session.access_token);
    return json({ error: "T\xE0i kho\u1EA3n ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5p quy\u1EC1n qu\u1EA3n tr\u1ECB." }, 403);
  }
  return json({ ok: true, session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: Math.floor(Date.now() / 1e3) + session.expires_in } });
}

// app/api/bookings/route.ts
var route_exports2 = {};
__export(route_exports2, {
  GET: () => GET2,
  POST: () => POST2,
  dynamic: () => dynamic
});

// public/booking/resources.js
var MEETING_TABLE = "added-a6fb9fd3-3fc2-4d1c-8aba-ae85531a4c94";
var source = (o) => o.source || o.id;
var chair = (o) => /^chair-\d+$/.test(source(o));
function bookingResources(data) {
  const objects = (data?.objects || []).filter((o) => !o.deleted), tables = objects.filter((o) => /^hex-\d+$/.test(source(o))), meeting = objects.find((o) => o.id === MEETING_TABLE);
  const members = meeting ? objects.filter(chair).filter((o) => Math.hypot(o.position[0] - meeting.position[0], o.position[2] - meeting.position[2]) < 2).sort((a, b) => a.id.localeCompare(b.id)) : [];
  const excluded = new Set(members.map((o) => o.id));
  const resources = objects.filter((o) => chair(o) && o.bookable && !excluded.has(o.id) && !/^chair-(77|78|79|80|81|82)$/.test(source(o))).map((o) => {
    const table = tables.filter((t) => t.id !== MEETING_TABLE).map((t) => ({ t, d: Math.hypot(o.position[0] - t.position[0], o.position[2] - t.position[2]) })).sort((a, b) => a.d - b.d)[0];
    const copyNumber = Number(source(o).slice(6));
    const copyIndex = objects.filter((c) => chair(c) && source(c) === source(o)).findIndex((c) => c.id === o.id) + 1;
    const number = Number(o.id.match(/^chair-(\d+)$/)?.[1]);
    const tableNumber = table && table.d < 2 ? Number(source(table.t).slice(4)) : null;
    const local = tableNumber && number >= 33 && number <= 68 ? (3 - (number - 33) % 6 + 6) % 6 + 1 : null;
    return { ...o, tableId: table && table.d < 2 ? table.t.id : null, tableNumber, code: local ? `B\xE0n ${tableNumber} \xB7 Gh\u1EBF ${String(local).padStart(2, "0")}` : number ? `G${String(number).padStart(2, "0")}` : `G${copyNumber}\u2013${copyIndex}`, shortCode: local ? String(local).padStart(2, "0") : number ? String(number) : String(copyIndex), label: local ? `B\xE0n ${tableNumber} \xB7 Gh\u1EBF ${local}` : o.label, capacity: 1, members: [o.id] };
  });
  if (meeting && members.length === 6 && members.every((o) => o.bookable)) resources.push({ ...meeting, tableId: meeting.id, tableNumber: 7, code: "B\xE0n 7", shortCode: "7", label: "B\xE0n 7 \xB7 \u0110\u1EB7t nguy\xEAn c\u1EE5m 6 ch\u1ED7", capacity: 6, members: members.map((o) => o.id) });
  return resources;
}

// app/booking-policy.ts
var defaults = { roomsOpen: true, seatsOpen: false, openMinute: 420, closeMinute: 1320, minMinutes: 30, maxRoomMinutes: 240, maxSeatMinutes: 480, stepMinutes: 15, advanceDays: 90, unlimitedBooking: true, bufferMinutes: 0, weekdays: [0, 1, 2, 3, 4, 5, 6], notice: "\u0110\u0103ng k\xFD \u0111\u01B0\u1EE3c chuy\u1EC3n \u0111\u1EBFn admin duy\u1EC7t. Sau khi g\u1EEDi, ng\u01B0\u1EDDi \u0111\u0103ng k\xFD kh\xF4ng t\u1EF1 s\u1EEDa ho\u1EB7c h\u1EE7y; vui l\xF2ng li\xEAn h\u1EC7 ng\u01B0\u1EDDi qu\u1EA3n l\xFD khi c\u1EA7n thay \u0111\u1ED5i." };
var localDay = () => (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
function dayValid(day) {
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(+/* @__PURE__ */ new Date(day + "T00:00:00Z")) && (/* @__PURE__ */ new Date(day + "T00:00:00Z")).toISOString().slice(0, 10) === day;
}
async function settings() {
  await env.DB.prepare("INSERT INTO booking_settings (id,data,revision) VALUES (?,?,1) ON CONFLICT(id) DO NOTHING").bind("main", JSON.stringify(defaults)).run();
  const row = await env.DB.prepare("SELECT data,revision FROM booking_settings WHERE id=?").bind("main").first();
  return { policy: { ...defaults, ...JSON.parse(row.data) }, revision: Number(row.revision) };
}
async function seedRooms() {
  const campus = "C\u01A1 s\u1EDF B \xB7 279 Nguy\u1EC5n Tri Ph\u01B0\u01A1ng \xB7 T\u1EA7ng 15";
  await env.DB.batch([["room-internal", "B1.1502 \xB7 Internal Meeting", 0], ["room-pod-1", "B1.1502 \xB7 Office Pod 01", 6], ["room-pod-2", "B1.1502 \xB7 Office Pod 02", 6]].map(([id, name, capacity]) => env.DB.prepare("INSERT INTO meeting_rooms (id,name,campus,capacity,accepting,revision) VALUES (?,?,?,?,1,1) ON CONFLICT(id) DO NOTHING").bind(id, name, campus, capacity)));
}
function policyValid(p) {
  return p && typeof p.roomsOpen === "boolean" && typeof p.seatsOpen === "boolean" && typeof p.unlimitedBooking === "boolean" && [p.openMinute, p.closeMinute, p.minMinutes, p.maxRoomMinutes, p.maxSeatMinutes, p.advanceDays, p.bufferMinutes].every(Number.isInteger) && p.openMinute >= 0 && p.closeMinute <= 1440 && p.closeMinute > p.openMinute && p.minMinutes >= 15 && p.minMinutes <= p.closeMinute - p.openMinute && p.maxRoomMinutes >= p.minMinutes && p.maxRoomMinutes <= 720 && p.maxSeatMinutes >= p.minMinutes && p.maxSeatMinutes <= 1440 && [15, 30, 60].includes(p.stepMinutes) && p.minMinutes % p.stepMinutes === 0 && p.openMinute % p.stepMinutes === 0 && p.closeMinute % p.stepMinutes === 0 && (p.unlimitedBooking || p.advanceDays >= 1 && p.advanceDays <= 366) && p.bufferMinutes >= 0 && p.bufferMinutes <= 60 && Array.isArray(p.weekdays) && p.weekdays.length > 0 && p.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) && typeof p.notice === "string" && p.notice.length <= 1e3;
}
function policyError(p, day, start, end, type) {
  if (!(type === "room" ? p.roomsOpen : p.seatsOpen)) return type === "room" ? "Hi\u1EC7n \u0111\xE3 \u0111\xF3ng nh\u1EADn \u0111\u0103ng k\xFD ph\xF2ng." : "Hi\u1EC7n \u0111\xE3 \u0111\xF3ng nh\u1EADn \u0111\u1EB7t gh\u1EBF.";
  if (!dayValid(day)) return "Ng\xE0y s\u1EED d\u1EE5ng kh\xF4ng h\u1EE3p l\u1EC7.";
  if (!Number.isInteger(start) || !Number.isInteger(end) || start % p.stepMinutes || end % p.stepMinutes) return "Gi\u1EDD b\u1EAFt \u0111\u1EA7u / k\u1EBFt th\xFAc c\u1EA7n theo b\u01B0\u1EDBc " + p.stepMinutes + " ph\xFAt.";
  if (start < p.openMinute || end > p.closeMinute || end <= start) return "Th\u1EDDi gian ph\u1EA3i n\u1EB1m trong gi\u1EDD ho\u1EA1t \u0111\u1ED9ng v\xE0 gi\u1EDD k\u1EBFt th\xFAc sau gi\u1EDD b\u1EAFt \u0111\u1EA7u.";
  const length = end - start, max = type === "room" ? p.maxRoomMinutes : p.maxSeatMinutes;
  if (length < p.minMinutes || !p.unlimitedBooking && length > max) return p.unlimitedBooking ? `Th\u1EDDi l\u01B0\u1EE3ng t\u1ED1i thi\u1EC3u ${p.minMinutes} ph\xFAt.` : `Th\u1EDDi l\u01B0\u1EE3ng ph\u1EA3i t\u1EEB ${p.minMinutes} \u0111\u1EBFn ${max} ph\xFAt.`;
  if (!p.weekdays.includes((/* @__PURE__ */ new Date(day + "T00:00:00Z")).getUTCDay())) return "Ng\xE0y n\xE0y kh\xF4ng n\u1EB1m trong l\u1ECBch ho\u1EA1t \u0111\u1ED9ng.";
  if (day < localDay()) return "Kh\xF4ng th\u1EC3 \u0111\u0103ng k\xFD ng\xE0y \u0111\xE3 qua.";
  const begins = +/* @__PURE__ */ new Date(day + "T00:00:00+07:00") + start * 6e4;
  if (!p.unlimitedBooking && begins > Date.now() + p.advanceDays * 864e5) return "Ch\u1EC9 \u0111\u0103ng k\xFD tr\u01B0\u1EDBc t\u1ED1i \u0111a " + p.advanceDays + " ng\xE0y.";
  return "";
}

// app/api/bookings/route.ts
var dynamic = "force-dynamic";
var response = (b, s = 200, cookie = null) => Response.json(b, { status: s, headers: { "Cache-Control": "no-store", ...cookie ? { "Set-Cookie": cookie } : {} } });
var conflictMessage = "C\xF3 \xEDt nh\u1EA5t m\u1ED9t ng\xE0y trong chu\u1ED7i b\u1ECB tr\xF9ng l\u1ECBch. Ch\u01B0a l\u01B0u l\u01B0\u1EE3t n\xE0o; h\xE3y \u0111\u1ED5i ng\xE0y ho\u1EB7c khung gi\u1EDD.";
async function GET2(r) {
  const u = await visitor(r), day = new URL(r.url).searchParams.get("day");
  if (!dayValid(day)) return response({ error: "Ng\xE0y kh\xF4ng h\u1EE3p l\u1EC7." }, 400, u.cookie);
  const rows = await env.DB.prepare("SELECT seat_id,seat_ids,resource_type,COALESCE(start_minute,start_slot*30) startMinute,COALESCE(end_minute,end_slot*30) endMinute,user_id,status FROM seat_bookings WHERE day=? AND resource_type='seat' AND status='active'").bind(day).all();
  const mine = await env.DB.prepare("SELECT id,status FROM seat_bookings WHERE user_id=? AND day=? AND resource_type='seat' ORDER BY created_at").bind(u.userId, day).all();
  return response({ reservations: rows.results.flatMap((b) => (b.seat_ids ? JSON.parse(b.seat_ids) : [b.seat_id]).map((seatId) => ({ seatId, resourceType: b.resource_type, startMinute: b.startMinute, endMinute: b.endMinute, mine: b.user_id === u.userId, status: b.status }))), mine: mine.results }, 200, u.cookie);
}
async function POST2(r) {
  const u = await visitor(r), json7 = (b2, s = 200) => response(b2, s, u.cookie);
  if (!sameOrigin(r)) return json7({ error: "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7." }, 403);
  let b;
  try {
    b = await r.json();
  } catch {
    return json7({ error: "D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  }
  if (b?.action) return json7({ error: "L\u01B0\u1EE3t \u0111\u1EB7t n\xE0y kh\xF4ng h\u1ED7 tr\u1EE3 t\u1EF1 s\u1EEDa ho\u1EB7c h\u1EE7y." }, 403);
  if (!b || typeof b !== "object") return json7({ error: "D\u1EEF li\u1EC7u \u0111\u0103ng k\xFD kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  const requested = Array.isArray(b.seatIds) ? b.seatIds : [b.seatId];
  if (!requested.length || requested.length > 36 || requested.some((id) => typeof id !== "string" || !id.length || id.length > 100) || new Set(requested).size !== requested.length) return json7({ error: "Ch\u1ECDn t\u1EEB 1 \u0111\u1EBFn 36 gh\u1EBF kh\xE1c nhau." }, 400);
  const seatIds = [...requested].sort();
  b.seatId = seatIds[0];
  const type = b.resourceType || "seat";
  if (type !== "seat") return json7({ error: "H\u1EC7 th\u1ED1ng hi\u1EC7n ch\u1EC9 nh\u1EADn \u0111\u1EB7t ch\u1ED7 ng\u1ED3i theo khung gi\u1EDD." }, 400);
  if (typeof b.attendees !== "number" || !Number.isInteger(b.attendees) || b.attendees < 1 || b.attendees > 1e3 || !["startup", "faculty", "staff", "other"].includes(b.groupType)) return json7({ error: "Ch\u1ECDn nh\xF3m \u0111\u1ED1i t\u01B0\u1EE3ng v\xE0 s\u1ED1 ng\u01B0\u1EDDi h\u1EE3p l\u1EC7." }, 400);
  for (const [key2, max] of [["displayName", 255], ["organization", 255], ["email", 255], ["phone", 20], ["leader", 255], ["subject", 255]]) if (typeof b[key2] !== "string" || !b[key2].trim() || b[key2].length > max) return json7({ error: "Vui l\xF2ng \u0111i\u1EC1n \u0111\u1EE7 h\u1ECD t\xEAn, \u0111\u01A1n v\u1ECB, email, \u0111i\u1EC7n tho\u1EA1i, ng\u01B0\u1EDDi ch\u1EE7 tr\xEC v\xE0 ti\xEAu \u0111\u1EC1." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || !/^\+?[\d\s().-]{8,20}$/.test(b.phone) || typeof b.description !== "string" || b.description.length > 2e3) return json7({ error: "Email, s\u1ED1 \u0111i\u1EC7n tho\u1EA1i ho\u1EB7c m\xF4 t\u1EA3 kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  if (b.occurrences !== void 0 && !Array.isArray(b.occurrences)) return json7({ error: "Danh s\xE1ch ng\xE0y l\u1EB7p kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  const occurrences = Array.isArray(b.occurrences) ? b.occurrences : [{ requestId: b.requestId, day: b.day, startMinute: b.startMinute, endMinute: b.endMinute }];
  if (!occurrences.length || occurrences.length > 52) return json7({ error: "M\u1ED9t l\u01B0\u1EE3t \u0111\u1EB7t l\u1EB7p t\u1ED1i \u0111a 52 l\u1EA7n h\xE0ng tu\u1EA7n." }, 400);
  const ids = /* @__PURE__ */ new Set(), days = /* @__PURE__ */ new Set();
  for (const occurrence of occurrences) {
    if (!occurrence || typeof occurrence.requestId !== "string" || !occurrence.requestId.length || occurrence.requestId.length > 80 || ids.has(occurrence.requestId) || !dayValid(occurrence.day) || days.has(occurrence.day) || !Number.isInteger(occurrence.startMinute) || !Number.isInteger(occurrence.endMinute)) return json7({ error: "Danh s\xE1ch ng\xE0y l\u1EB7p kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c b\u1ECB tr\xF9ng." }, 400);
    ids.add(occurrence.requestId);
    days.add(occurrence.day);
  }
  const config2 = await settings();
  for (const occurrence of occurrences) {
    const error = policyError(config2.policy, occurrence.day, occurrence.startMinute, occurrence.endMinute, type);
    if (error) return json7({ error: occurrence.day + ": " + error }, 400);
  }
  const pending = [];
  for (const occurrence of occurrences) {
    const prior = await env.DB.prepare("SELECT user_id,seat_id,seat_ids,day,COALESCE(start_minute,start_slot*30) startMinute,COALESCE(end_minute,end_slot*30) endMinute,status FROM seat_bookings WHERE id=?").bind(occurrence.requestId).first();
    if (prior) {
      const priorSeats = (prior.seat_ids ? JSON.parse(prior.seat_ids) : [prior.seat_id]).sort();
      if (prior.user_id !== u.userId || JSON.stringify(priorSeats) !== JSON.stringify(seatIds) || prior.day !== occurrence.day || prior.startMinute !== occurrence.startMinute || prior.endMinute !== occurrence.endMinute) return json7({ error: "M\u1ED9t y\xEAu c\u1EA7u trong chu\u1ED7i \u0111\xE3 t\u1ED3n t\u1EA1i v\u1EDBi n\u1ED9i dung kh\xE1c. Vui l\xF2ng t\u1EA3i l\u1EA1i." }, 409);
    } else pending.push(occurrence);
  }
  if (!pending.length) return json7({ ok: true, id: occurrences[0].requestId, status: "pending", count: occurrences.length, alreadySaved: true });
  const recent = await env.DB.prepare("SELECT COUNT(*) n FROM seat_bookings WHERE user_id=? AND created_at>=?").bind(u.userId, new Date(Date.now() - 36e5).toISOString()).first();
  if (Number(recent?.n || 0) + pending.length > 120) {
    const limited = json7({ error: "Phi\xEAn n\xE0y \u0111\xE3 g\u1EEDi nhi\u1EC1u l\u01B0\u1EE3t trong m\u1ED9t gi\u1EDD. Vui l\xF2ng th\u1EED l\u1EA1i sau." }, 429);
    limited.headers.set("Retry-After", "3600");
    return limited;
  }
  const space = await env.DB.prepare("SELECT data,revision FROM spatial_spaces WHERE id=?").bind("main").first();
  if (!space) return json7({ error: "S\u01A1 \u0111\u1ED3 ch\u1ED7 ng\u1ED3i ch\u01B0a \u0111\u01B0\u1EE3c \xE1p d\u1EE5ng." }, 409);
  const resources = bookingResources(JSON.parse(space.data));
  const chosen = seatIds.map((id) => resources.find((o) => o.id === id));
  if (chosen.some((o) => !o)) return json7({ error: "C\xF3 gh\u1EBF kh\xF4ng c\xF2n m\u1EDF \u0111\u1EB7t ri\xEAng. Ch\u1ECDn l\u1EA1i gh\u1EBF l\u1EBB ho\u1EB7c B\xE0n 7 tr\xEAn s\u01A1 \u0111\u1ED3." }, 409);
  if (chosen.length > 1 && chosen.some((o) => o.capacity !== 1)) return json7({ error: "B\xE0n 7 \u0111\u01B0\u1EE3c \u0111\u1EB7t ri\xEAng nguy\xEAn 6 ch\u1ED7; kh\xF4ng gh\xE9p v\u1EDBi gh\u1EBF l\u1EBB." }, 400);
  const capacity = chosen.reduce((sum, o) => sum + o.capacity, 0);
  if (b.attendees !== capacity) return json7({ error: "S\u1ED1 ch\u1ED7 ph\u1EA3i \u0111\xFAng v\u1EDBi to\xE0n b\u1ED9 gh\u1EBF \u0111\xE3 ch\u1ECDn (" + capacity + " ch\u1ED7)." }, 400);
  const conflictIds = [...new Set(chosen.flatMap((o) => [o.id, ...o.members]))];
  const name = chosen.map((o) => o.capacity === 6 ? o.label : o.code).join("; ");
  const resourceRevision = Number(space.revision), buffer = config2.policy.bufferMinutes;
  for (const occurrence of pending) {
    const placeholders = conflictIds.map(() => "?").join(",");
    const conflict = await env.DB.prepare(`SELECT id FROM seat_bookings WHERE EXISTS (SELECT 1 FROM json_each(COALESCE(seat_ids,json_array(seat_id))) held WHERE held.value IN (${placeholders})) AND day=? AND status='active' AND COALESCE(start_minute,start_slot*30) < ? AND COALESCE(end_minute,end_slot*30) > ? LIMIT 1`).bind(...conflictIds, occurrence.day, occurrence.endMinute + buffer, occurrence.startMinute - buffer).first();
    if (conflict) return json7({ error: conflictMessage, conflictDay: occurrence.day }, 409);
  }
  const statements = pending.map((occurrence) => {
    const columns = "id,user_id,seat_id,seat_label,day,start_slot,end_slot,display_name,organization,status,created_at,email,phone,leader,subject,description,group_type,attendees,resource_type,campus,start_minute,end_minute,seat_ids";
    const values = [occurrence.requestId, u.userId, b.seatId, name, occurrence.day, occurrence.startMinute / 30, occurrence.endMinute / 30, b.displayName.trim(), b.organization.trim(), "pending", (/* @__PURE__ */ new Date()).toISOString(), b.email.trim(), b.phone.trim(), b.leader.trim(), b.subject.trim(), b.description.trim(), b.groupType, b.attendees, type, "C\u01A1 s\u1EDF B \xB7 279 Nguy\u1EC5n Tri Ph\u01B0\u01A1ng \xB7 T\u1EA7ng 15", occurrence.startMinute, occurrence.endMinute, JSON.stringify(seatIds)];
    const placeholders = conflictIds.map(() => "?").join(",");
    const query = `INSERT INTO seat_bookings (${columns}) SELECT ${values.map(() => "?").join(",")} WHERE EXISTS (SELECT 1 FROM booking_settings WHERE id='main' AND revision=?) AND EXISTS (SELECT 1 FROM spatial_spaces WHERE id='main' AND revision=?) AND NOT EXISTS (SELECT 1 FROM seat_bookings WHERE EXISTS (SELECT 1 FROM json_each(COALESCE(seat_ids,json_array(seat_id))) held WHERE held.value IN (${placeholders})) AND day=? AND status='active' AND COALESCE(start_minute,start_slot*30) < ? AND COALESCE(end_minute,end_slot*30) > ?)`;
    return env.DB.prepare(query).bind(...values, config2.revision, resourceRevision, ...conflictIds, occurrence.day, occurrence.endMinute + buffer, occurrence.startMinute - buffer);
  });
  const results = await env.DB.batch(statements);
  if (results.some((result) => Number(result.meta?.changes) !== 1)) throw new Error("BOOKING_CONFLICT");
  return json7({ ok: true, id: occurrences[0].requestId, status: "pending", count: occurrences.length, created: pending.length });
}

// app/api/admin/bookings/route.ts
var route_exports3 = {};
__export(route_exports3, {
  GET: () => GET3,
  POST: () => POST3,
  dynamic: () => dynamic2
});
var dynamic2 = "force-dynamic";
var json2 = (b, s = 200) => Response.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
var editToken = (row) => JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k]) => k !== "edit_token").sort(([a], [b]) => a.localeCompare(b))));
async function GET3(r) {
  if (!await getAdmin(r)) return json2({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp admin." }, 401);
  const url = new URL(r.url), day = url.searchParams.get("day"), status = url.searchParams.get("status"), query = (url.searchParams.get("search") || "").trim().toLowerCase();
  let offset = Number(url.searchParams.get("offset") || 0);
  const limit = Number(url.searchParams.get("limit") || 100), from = url.searchParams.get("from"), to = url.searchParams.get("to");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || from && !dayValid(from) || to && !dayValid(to) || from && to && from > to || !Number.isSafeInteger(offset) || offset < 0 || query.length > 255 || day && !dayValid(day) || status && !["pending", "active", "rejected", "cancelled"].includes(status)) return json2({ error: "B\u1ED9 l\u1ECDc kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  const conditions = ["resource_type='seat'"], args = [];
  if (url.searchParams.get("excludeCancelled") === "1") conditions.push("status<>'cancelled'");
  if (day) {
    conditions.push("day=?");
    args.push(day);
  }
  if (from) {
    conditions.push("day>=?");
    args.push(from);
  }
  if (to) {
    conditions.push("day<=?");
    args.push(to);
  }
  const totalConditions = [...conditions], totalArgs = [...args];
  if (status) {
    conditions.push("status=?");
    args.push(status);
  }
  if (query) {
    conditions.push("position(? in lower(concat_ws(' ',display_name,organization,seat_label,subject,email,phone,id)))>0");
    args.push(query);
  }
  const count = await env.DB.prepare("SELECT COUNT(*) n FROM seat_bookings WHERE " + conditions.join(" AND ")).bind(...args).first();
  const totalCount = Number(count.n);
  offset = Math.min(offset, Math.max(0, (Math.ceil(totalCount / limit) - 1) * limit));
  const rows = await env.DB.prepare("SELECT * FROM seat_bookings WHERE " + conditions.join(" AND ") + " ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?").bind(...args, limit + 1, offset).all();
  const totals = await env.DB.prepare("SELECT status,COUNT(*) n FROM seat_bookings WHERE " + totalConditions.join(" AND ") + (query ? " AND position(? in lower(concat_ws(' ',display_name,organization,seat_label,subject,email,phone,id)))>0" : "") + " GROUP BY status").bind(...totalArgs, ...query ? [query] : []).all();
  return json2({ bookings: rows.results.slice(0, limit).map((b) => ({ ...b, edit_token: editToken(b) })), totals: totals.results, totalCount, offset, limit, hasMore: rows.results.length > limit });
}
async function POST3(r) {
  if (!await getAdmin(r)) return json2({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp admin." }, 401);
  if (!sameOrigin(r)) return json2({ error: "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7." }, 403);
  let b;
  try {
    b = await r.json();
  } catch {
    return json2({ error: "D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  }
  if (typeof b?.id !== "string" || b.note !== void 0 && (typeof b.note !== "string" || b.note.length > 1e3) || !["approve", "edit", "reject", "cancel", "reopen", "delete"].includes(b.action)) return json2({ error: "Thao t\xE1c kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  const current = await env.DB.prepare("SELECT * FROM seat_bookings WHERE id=? AND resource_type='seat'").bind(b.id).first();
  if (!current) return json2({ error: "Kh\xF4ng t\xECm th\u1EA5y y\xEAu c\u1EA7u." }, 404);
  if (b.expectedToken && b.expectedToken !== editToken(current)) return json2({ error: "Y\xEAu c\u1EA7u \u0111\xE3 \u0111\u01B0\u1EE3c thay \u0111\u1ED5i. \u0110\xF3ng bi\u1EC3u m\u1EABu v\xE0 t\u1EA3i l\u1EA1i tr\u01B0\u1EDBc khi x\u1EED l\xFD." }, 409);
  if (b.action === "delete") {
    if (!b.expectedToken) return json2({ error: "T\u1EA3i l\u1EA1i l\u01B0\u1EE3t \u0111\u1EB7t tr\u01B0\u1EDBc khi x\xF3a." }, 409);
    await env.DB.prepare("DELETE FROM seat_claims WHERE booking_id=?").bind(b.id).run();
    await env.DB.prepare("DELETE FROM seat_bookings WHERE id=?").bind(b.id).run();
    return json2({ ok: true });
  }
  if (b.action === "edit" || b.action === "approve") {
    if (b.action === "approve" && current.status === "active") return json2({ error: "L\u01B0\u1EE3t \u0111\u1EB7t \u0111\xE3 \u0111\u01B0\u1EE3c duy\u1EC7t." }, 409);
    const ids = b.action === "edit" ? b.seatIds : current.seat_ids ? JSON.parse(current.seat_ids) : [current.seat_id];
    if (!Array.isArray(ids) || !ids.length || ids.length > 36 || ids.some((id) => typeof id !== "string" || id.length > 100) || new Set(ids).size !== ids.length) return json2({ error: "Ch\u1ECDn t\u1EEB 1 \u0111\u1EBFn 36 ch\u1ED7 kh\xE1c nhau." }, 400);
    const seatIds = [...ids].sort(), space = await env.DB.prepare("SELECT data,revision FROM spatial_spaces WHERE id='main'").first(), resources = space ? bookingResources(JSON.parse(space.data)) : [], chosen = seatIds.map((id) => resources.find((o) => o.id === id));
    if (chosen.some((o) => !o) || chosen.length > 1 && chosen.some((o) => o.capacity !== 1)) return json2({ error: "Ch\u1ECDn gh\u1EBF \u0111ang m\u1EDF; B\xE0n 7 ph\u1EA3i \u0111\u0103ng k\xFD ri\xEAng nguy\xEAn c\u1EE5m." }, 400);
    const fields = b.action === "edit" ? b : { day: current.day, startMinute: current.start_minute ?? Number(current.start_slot) * 30, endMinute: current.end_minute ?? Number(current.end_slot) * 30 };
    if (!dayValid(fields.day)) return json2({ error: "Ng\xE0y kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
    const unchanged = fields.day === current.day && fields.startMinute === (current.start_minute ?? Number(current.start_slot) * 30) && fields.endMinute === (current.end_minute ?? Number(current.end_slot) * 30) && JSON.stringify(seatIds) === JSON.stringify((current.seat_ids ? JSON.parse(current.seat_ids) : [current.seat_id]).sort());
    const cfg = await settings();
    if (b.action === "approve" || !unchanged) {
      const error = policyError({ ...cfg.policy, seatsOpen: true }, fields.day, fields.startMinute, fields.endMinute, "seat");
      if (error) return json2({ error }, 400);
    }
    const conflicts = [...new Set(chosen.flatMap((o) => [o.id, ...o.members]))];
    const snapshotKeys = Object.keys(current).filter((k) => k !== "id"), guard = snapshotKeys.map((k) => `${k} IS ?`).join(" AND "), snapshotValues = snapshotKeys.map((k) => current[k]);
    let assignments, values;
    if (b.action === "edit") {
      for (const [key2, max] of [["displayName", 255], ["organization", 255], ["email", 255], ["phone", 20], ["leader", 255], ["subject", 255]]) if (typeof b[key2] !== "string" || !b[key2].trim() || b[key2].length > max) return json2({ error: "\u0110i\u1EC1n \u0111\u1EA7y \u0111\u1EE7 h\u1ECD t\xEAn, \u0111\u01A1n v\u1ECB, email, \u0111i\u1EC7n tho\u1EA1i, ng\u01B0\u1EDDi ph\u1EE5 tr\xE1ch v\xE0 m\u1EE5c \u0111\xEDch." }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || !/^\+?[\d\s().-]{8,20}$/.test(b.phone) || typeof b.description !== "string" || b.description.length > 2e3 || !["startup", "faculty", "staff", "other"].includes(b.groupType) || typeof b.adminNote !== "string" || b.adminNote.length > 1e3) return json2({ error: "Th\xF4ng tin li\xEAn h\u1EC7, nh\xF3m ho\u1EB7c ghi ch\xFA kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
      const changes = { day: b.day, start_minute: b.startMinute, end_minute: b.endMinute, start_slot: b.startMinute / 30, end_slot: b.endMinute / 30, seat_id: seatIds[0], seat_ids: JSON.stringify(seatIds), seat_label: chosen.map((o) => o.capacity === 6 ? o.label : o.code).join("; "), attendees: chosen.reduce((n, o) => n + o.capacity, 0), display_name: b.displayName.trim(), organization: b.organization.trim(), email: b.email.trim(), phone: b.phone.trim(), leader: b.leader.trim(), subject: b.subject.trim(), description: b.description.trim(), group_type: b.groupType, admin_note: b.adminNote.trim() };
      assignments = Object.keys(changes).map((k) => `${k}=?`).join(",");
      values = Object.values(changes);
    } else {
      assignments = "status='active',admin_note=?";
      values = [b.note || ""];
    }
    const checkOverlap = b.action === "approve" || current.status === "active" || current.status === "pending" && !unchanged;
    const overlap = checkOverlap ? ` AND NOT EXISTS (SELECT 1 FROM seat_bookings other WHERE other.id<>? AND other.status='active' AND other.day=? AND EXISTS (SELECT 1 FROM json_each(COALESCE(other.seat_ids,json_array(other.seat_id))) held WHERE held.value IN (${conflicts.map(() => "?").join(",")})) AND COALESCE(other.start_minute,other.start_slot*30)<? AND COALESCE(other.end_minute,other.end_slot*30)>?)` : "";
    const overlapArgs = checkOverlap ? [b.id, fields.day, ...conflicts, fields.endMinute + cfg.policy.bufferMinutes, fields.startMinute - cfg.policy.bufferMinutes] : [];
    const result = await env.DB.prepare(`UPDATE seat_bookings SET ${assignments} WHERE id=? AND ${guard} AND EXISTS (SELECT 1 FROM spatial_spaces WHERE id='main' AND revision=?) AND EXISTS (SELECT 1 FROM booking_settings WHERE id='main' AND revision=?)${overlap}`).bind(...values, b.id, ...snapshotValues, Number(space.revision), cfg.revision, ...overlapArgs).run();
    if (!result.meta.changes) return json2({ error: "C\xF3 l\u1ECBch \u0111\xE3 duy\u1EC7t tr\xF9ng gi\u1EDD ho\u1EB7c d\u1EEF li\u1EC7u v\u1EEBa thay \u0111\u1ED5i. Ch\u01B0a l\u01B0u thay \u0111\u1ED5i; h\xE3y t\u1EA3i l\u1EA1i." }, 409);
  } else {
    const status = { reject: "rejected", cancel: "cancelled", reopen: "pending" }[b.action];
    if (current.status === status) return json2({ error: "L\u01B0\u1EE3t \u0111\u1EB7t \u0111\xE3 \u1EDF tr\u1EA1ng th\xE1i n\xE0y. H\xE3y c\u1EADp nh\u1EADt danh s\xE1ch." }, 409);
    await env.DB.prepare("DELETE FROM seat_claims WHERE booking_id=?").bind(b.id).run();
    await env.DB.prepare("UPDATE seat_bookings SET status=?,admin_note=? WHERE id=?").bind(status, b.note || "", b.id).run();
  }
  return json2({ ok: true });
}

// app/api/admin/backup/route.ts
var route_exports4 = {};
__export(route_exports4, {
  GET: () => GET4,
  dynamic: () => dynamic3
});
var dynamic3 = "force-dynamic";
async function GET4(request) {
  if (!await getAdmin(request)) return Response.json({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp admin." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const names = ["spatial_layouts", "spatial_spaces", "booking_settings", "meeting_rooms", "seat_bookings", "seat_claims"];
  const results = await env.DB.batch(names.map((name) => env.DB.prepare("SELECT * FROM " + name)));
  const tables = Object.fromEntries(names.map((name, i) => [name, results[i].results]));
  return Response.json({ format: "uii-booking-backup", version: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), tables }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": 'attachment; filename="uii-backup-' + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + '.json"' } });
}

// app/api/layouts/route.ts
var route_exports5 = {};
__export(route_exports5, {
  GET: () => GET5,
  POST: () => POST4,
  dynamic: () => dynamic4
});

// app/layout-validation.ts
function layoutValid(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.objects) || data.objects.length > 2e3) return false;
  const ids = /* @__PURE__ */ new Set();
  for (const o of data.objects) {
    if (!o || typeof o.id !== "string" || !o.id.length || o.id.length > 100 || ids.has(o.id)) return false;
    if (!["position", "rotation", "scale"].every((k) => Array.isArray(o[k]) && o[k].length === 3 && o[k].every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e4)) || o.scale.some((v) => v <= 0 || v > 1e3)) return false;
    if (o.label !== void 0 && (typeof o.label !== "string" || o.label.length > 100)) return false;
    if (o.source !== void 0 && (typeof o.source !== "string" || !o.source.length || o.source.length > 100)) return false;
    if (["bookable", "deleted"].some((k) => o[k] !== void 0 && typeof o[k] !== "boolean")) return false;
    if (o.color != null && (typeof o.color !== "string" || !/^#[a-f0-9]{6}$/i.test(o.color))) return false;
    ids.add(o.id);
  }
  return true;
}

// app/api/layouts/route.ts
var dynamic4 = "force-dynamic";
var json3 = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function GET5(request) {
  const user = await getAdmin(request);
  if (!user) return json3({ error: "B\u1EA1n c\u1EA7n \u0111\u0103ng nh\u1EADp \u0111\u1EC3 m\u1EDF b\u1EA3n l\u01B0u." }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const row = await env.DB.prepare("SELECT * FROM spatial_layouts WHERE id = ?").bind(id).first();
    if (!row) return json3({ error: "Kh\xF4ng t\xECm th\u1EA5y b\u1EA3n l\u01B0u." }, 404);
    return json3({ ...row, data: JSON.parse(row.data) });
  }
  const rows = await env.DB.prepare("SELECT id, name, revision, updated_at FROM spatial_layouts ORDER BY updated_at DESC LIMIT 100").all();
  return json3({ layouts: rows.results });
}
async function POST4(request) {
  const user = await getAdmin(request);
  if (!user) return json3({ error: "B\u1EA1n c\u1EA7n \u0111\u0103ng nh\u1EADp \u0111\u1EC3 l\u01B0u." }, 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json3({ error: "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7." }, 403);
  let b;
  try {
    if (Number(request.headers.get("content-length") || 0) > 2e6) return json3({ error: "B\u1EA3n l\u01B0u qu\xE1 l\u1EDBn." }, 413);
    b = await request.json();
  } catch {
    return json3({ error: "D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  }
  if (!b || typeof b.name !== "string" || !b.name.trim() || b.name.length > 120 || !b.data || b.data.version !== 1 || !Array.isArray(b.data.objects) || b.data.objects.length > 2e3) return json3({ error: "D\u1EEF li\u1EC7u b\u1EA3n v\u1EBD kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  if (!layoutValid(b.data)) return json3({ error: "Th\xF4ng s\u1ED1 ho\u1EB7c th\xF4ng tin v\u1EADt th\u1EC3 kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  const data = JSON.stringify(b.data);
  if (data.length > 2e6) return json3({ error: "B\u1EA3n l\u01B0u qu\xE1 l\u1EDBn." }, 413);
  const now = (/* @__PURE__ */ new Date()).toISOString(), id = typeof b.id === "string" ? b.id : crypto.randomUUID();
  if (b.id) {
    const changed = await env.DB.prepare("UPDATE spatial_layouts SET name = ?, data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?").bind(b.name.trim(), data, now, id, b.revision).run();
    if (!changed.meta.changes) return json3({ error: "B\u1EA3n v\u1EBD \u0111\xE3 thay \u0111\u1ED5i \u1EDF n\u01A1i kh\xE1c. H\xE3y l\u01B0u th\xE0nh b\u1EA3n m\u1EDBi \u0111\u1EC3 gi\u1EEF thay \u0111\u1ED5i c\u1EE7a b\u1EA1n." }, 409);
  } else await env.DB.prepare("INSERT INTO spatial_layouts (id, owner_id, name, data, revision, updated_at) VALUES (?, ?, ?, ?, 1, ?)").bind(id, user.userId, b.name.trim(), data, now).run();
  const row = await env.DB.prepare("SELECT id, name, revision, updated_at FROM spatial_layouts WHERE id = ?").bind(id).first();
  return json3(row);
}

// app/api/space/route.ts
var route_exports6 = {};
__export(route_exports6, {
  GET: () => GET6,
  POST: () => POST5,
  dynamic: () => dynamic5
});
var dynamic5 = "force-dynamic";
var json4 = (b, s = 200) => Response.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
async function GET6(r) {
  const u = await getAdmin(r);
  const row = await env.DB.prepare("SELECT * FROM spatial_spaces WHERE id = ?").bind("main").first();
  return json4({ space: row ? { name: row.name, data: JSON.parse(row.data), revision: row.revision, updatedAt: row.updated_at } : null, isAdmin: !!u });
}
async function POST5(r) {
  const u = await getAdmin(r);
  if (!u) return json4({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp." }, 401);
  if (r.headers.get("origin") && r.headers.get("origin") !== new URL(r.url).origin) return json4({ error: "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7." }, 403);
  let b;
  try {
    b = await r.json();
  } catch {
    return json4({ error: "D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  }
  if (!b?.data || b.data.version !== 1 || !Array.isArray(b.data.objects) || b.data.objects.length > 2e3 || JSON.stringify(b.data).length > 2e6 || typeof b.name !== "string" || b.name.length > 120) return json4({ error: "S\u01A1 \u0111\u1ED3 kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  if (!layoutValid(b.data)) return json4({ error: "Th\xF4ng s\u1ED1 ho\u1EB7c th\xF4ng tin v\u1EADt th\u1EC3 kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  const row = await env.DB.prepare("SELECT owner_id, revision FROM spatial_spaces WHERE id = ?").bind("main").first();
  const resources = bookingResources(b.data);
  const future = await env.DB.prepare("SELECT DISTINCT held.value seat_id FROM seat_bookings c,json_each(COALESCE(c.seat_ids,json_array(c.seat_id))) held WHERE c.resource_type='seat' AND c.status IN ('pending','active') AND c.day>=?").bind((/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })).all();
  if (future.results.some((r2) => !resources.some((o) => o.id === r2.seat_id || o.members.includes(r2.seat_id)))) return json4({ error: "Gi\u1EEF nguy\xEAn c\xE1c gh\u1EBF / c\u1EE5m c\xF3 \u0111\u0103ng k\xFD s\u1EAFp t\u1EDBi tr\u01B0\u1EDBc khi \xE1p d\u1EE5ng." }, 409);
  const data = JSON.stringify(b.data), now = (/* @__PURE__ */ new Date()).toISOString(), today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  if (!row) {
    const result = await env.DB.prepare("INSERT INTO spatial_spaces (id,owner_id,name,data,revision,updated_at) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(id) DO NOTHING").bind("main", u.userId, b.name, data, now).run();
    if (!result.meta.changes) return json4({ error: "S\u01A1 \u0111\u1ED3 \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o. H\xE3y t\u1EA3i l\u1EA1i tr\u01B0\u1EDBc khi \xE1p d\u1EE5ng." }, 409);
  } else {
    const result = await env.DB.prepare("UPDATE spatial_spaces SET name = ?, data = ?, revision = revision + 1, updated_at = ? WHERE id = 'main' AND revision = ? AND NOT EXISTS (SELECT 1 FROM seat_bookings c,json_each(COALESCE(c.seat_ids,json_array(c.seat_id))) held WHERE c.resource_type='seat' AND c.status IN ('pending','active') AND c.day >= ? AND NOT EXISTS (SELECT 1 FROM json_each(?) allowed WHERE allowed.value = held.value))").bind(b.name, data, now, b.revision, today, JSON.stringify(resources.flatMap((o) => [o.id, ...o.members]))).run();
    if (!result.meta.changes) return json4({ error: "S\u01A1 \u0111\u1ED3 \u0111\xE3 thay \u0111\u1ED5i ho\u1EB7c b\u1EA1n \u0111ang x\xF3a gh\u1EBF c\xF3 l\u01B0\u1EE3t \u0111\u1EB7t s\u1EAFp t\u1EDBi. H\xE3y t\u1EA3i l\u1EA1i / gi\u1EEF gh\u1EBF \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u1EB7t." }, 409);
  }
  return json4({ ok: true });
}

// app/api/settings/route.ts
var route_exports7 = {};
__export(route_exports7, {
  GET: () => GET7,
  POST: () => POST6,
  dynamic: () => dynamic6
});
var dynamic6 = "force-dynamic";
var json5 = (b, s = 200) => Response.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
async function GET7() {
  return json5(await settings());
}
async function POST6(r) {
  if (!await getAdmin(r)) return json5({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp admin." }, 401);
  if (!sameOrigin(r)) return json5({ error: "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7." }, 403);
  let b;
  try {
    b = await r.json();
  } catch {
    return json5({ error: "D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  }
  if (!policyValid(b?.policy)) return json5({ error: "Ki\u1EC3m tra l\u1EA1i gi\u1EDD m\u1EDF/\u0111\xF3ng, th\u1EDDi l\u01B0\u1EE3ng v\xE0 b\u01B0\u1EDBc th\u1EDDi gian." }, 400);
  await settings();
  const changed = await env.DB.prepare("UPDATE booking_settings SET data=?,revision=revision+1 WHERE id=? AND revision=?").bind(JSON.stringify(b.policy), "main", b.revision).run();
  if (!changed.meta.changes) return json5({ error: "C\u1EA5u h\xECnh \u0111\xE3 thay \u0111\u1ED5i \u1EDF n\u01A1i kh\xE1c. H\xE3y t\u1EA3i l\u1EA1i." }, 409);
  return json5({ ok: true, ...await settings() });
}

// app/api/rooms/route.ts
var route_exports8 = {};
__export(route_exports8, {
  GET: () => GET8,
  POST: () => POST7,
  dynamic: () => dynamic7
});
var dynamic7 = "force-dynamic";
var json6 = (b, s = 200) => Response.json(b, { status: s, headers: { "Cache-Control": "no-store" } });
async function GET8() {
  await seedRooms();
  return json6({ rooms: (await env.DB.prepare("SELECT * FROM meeting_rooms ORDER BY name").all()).results });
}
async function POST7(r) {
  if (!await getAdmin(r)) return json6({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp admin." }, 401);
  if (!sameOrigin(r)) return json6({ error: "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7." }, 403);
  let b;
  try {
    b = await r.json();
  } catch {
    return json6({ error: "D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  }
  if (!b || typeof b.name !== "string" || !b.name.trim() || b.name.length > 150 || typeof b.campus !== "string" || !b.campus.trim() || b.campus.length > 200 || !Number.isInteger(b.capacity) || b.capacity < 0 || b.capacity > 1e3 || typeof b.accepting !== "boolean") return json6({ error: "T\xEAn ph\xF2ng, c\u01A1 s\u1EDF, s\u1EE9c ch\u1EE9a v\xE0 tr\u1EA1ng th\xE1i ch\u01B0a h\u1EE3p l\u1EC7." }, 400);
  const id = b.id || "room-" + crypto.randomUUID();
  if (b.id) {
    const result = await env.DB.prepare("UPDATE meeting_rooms SET name=?,campus=?,capacity=?,accepting=?,revision=revision+1 WHERE id=? AND revision=?").bind(b.name.trim(), b.campus.trim(), b.capacity, b.accepting ? 1 : 0, id, b.revision).run();
    if (!result.meta.changes) return json6({ error: "Ph\xF2ng \u0111\xE3 thay \u0111\u1ED5i. H\xE3y t\u1EA3i l\u1EA1i." }, 409);
  } else await env.DB.prepare("INSERT INTO meeting_rooms (id,name,campus,capacity,accepting,revision) VALUES (?,?,?,?,?,1)").bind(id, b.name.trim(), b.campus.trim(), b.capacity, b.accepting ? 1 : 0).run();
  return json6({ ok: true, id });
}

// app/edge-handler.ts
var routes = { "/api/admin/auth": route_exports, "/api/bookings": route_exports2, "/api/admin/bookings": route_exports3, "/api/admin/backup": route_exports4, "/api/layouts": route_exports5, "/api/space": route_exports6, "/api/settings": route_exports7, "/api/rooms": route_exports8 };
async function boundedBody(request, limit) {
  if (!request.body) return "";
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw Error("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
function createHandler(transaction, config2) {
  return async (request) => {
    const origin = request.headers.get("origin"), allowed = config2.ALLOWED_ORIGIN;
    const headers = { "Cache-Control": "no-store", "Vary": "Origin", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" };
    if (origin !== allowed) return Response.json({ error: "Ngu\u1ED3n truy c\u1EADp kh\xF4ng h\u1EE3p l\u1EC7." }, { status: 403, headers });
    Object.assign(headers, { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-visitor-token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Expose-Headers": "x-visitor-token, content-disposition" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url), path = url.searchParams.get("route") || "", module = Object.hasOwn(routes, path) ? routes[path] : void 0, fn = module?.[request.method];
    if (!fn) return Response.json({ error: "Kh\xF4ng t\xECm th\u1EA5y ch\u1EE9c n\u0103ng." }, { status: module ? 405 : 404, headers });
    if (request.method === "POST" && request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "Ch\u1EC9 nh\u1EADn d\u1EEF li\u1EC7u JSON." }, { status: 415, headers });
    const limit = ["/api/layouts", "/api/space"].includes(path) ? 21e5 : 65536;
    if (Number(request.headers.get("content-length") || 0) > limit) return Response.json({ error: "D\u1EEF li\u1EC7u qu\xE1 l\u1EDBn." }, { status: 413, headers });
    try {
      const body = request.method === "GET" ? void 0 : await boundedBody(request, limit);
      url.searchParams.delete("route");
      const internal = new URL(allowed);
      internal.pathname = path;
      internal.search = url.search;
      const normalized = new Request(internal, { method: request.method, headers: request.headers, body });
      return await transaction(async (client) => {
        await client.unsafe("SET LOCAL search_path TO uii, pg_temp");
        await client.unsafe("SELECT pg_advisory_xact_lock(15021502)");
        const state = { ...config2, DB: database(client) };
        return context.run(state, async () => {
          const result = await fn(normalized);
          const h = new Headers(result.headers);
          for (const [k, v] of Object.entries(headers)) h.set(k, v);
          if (state.visitorToken) h.set("x-visitor-token", state.visitorToken);
          h.delete("set-cookie");
          return new Response(result.body, { status: result.status, headers: h });
        });
      });
    } catch (e) {
      const message = String(e?.message || "");
      if (message === "BODY_TOO_LARGE") return Response.json({ error: "D\u1EEF li\u1EC7u qu\xE1 l\u1EDBn." }, { status: 413, headers });
      if (message === "BOOKING_CONFLICT") return Response.json({ error: "C\xF3 l\u01B0\u1EE3t v\u1EEBa \u0111\u01B0\u1EE3c \u0111\u1EB7t ho\u1EB7c c\u1EA5u h\xECnh \u0111\xE3 thay \u0111\u1ED5i. Ch\u01B0a l\u01B0u chu\u1ED7i \u0111\u1EB7t l\u1EB7p; h\xE3y t\u1EA3i l\u1EA1i v\xE0 th\u1EED l\u1EA1i." }, { status: 409, headers });
      console.error("UII API failed", request.method, path, e?.code || "error");
      return Response.json({ error: "Ch\u01B0a x\u1EED l\xFD \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u. Ki\u1EC3m tra c\u1EA5u h\xECnh Supabase v\xE0 th\u1EED l\u1EA1i." }, { status: 500, headers });
    }
  };
}

// supabase/edge-entry.ts
var get = (key2) => {
  const v = Deno.env.get(key2);
  if (!v) throw Error("Missing " + key2);
  return v;
};
var sql = postgres(get("SUPABASE_DB_URL"), { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10, ssl: "require" });
var config = { SUPABASE_URL: get("SUPABASE_URL"), SUPABASE_ANON_KEY: get("SUPABASE_ANON_KEY"), ALLOWED_ORIGIN: get("ALLOWED_ORIGIN"), VISITOR_SECRET: get("VISITOR_SECRET") };
Deno.serve(createHandler((fn) => sql.begin(fn), config));

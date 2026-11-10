import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {build} from 'esbuild';import {PGlite} from '@electric-sql/pglite';
const bundled=await build({entryPoints:['app/edge-handler.ts'],bundle:true,platform:'node',format:'esm',write:false});const {createHandler}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const db=new PGlite();await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');");await db.exec(fs.readFileSync('supabase/migrations/202611080001_initial.sql','utf8'));await db.exec("INSERT INTO uii.admin_users VALUES ('11111111-1111-4111-8111-111111111111');");
const realFetch=globalThis.fetch;globalThis.fetch=async(input,init)=>{const url=String(input),h=new Headers(init?.headers);if(url.endsWith('/auth/v1/user'))return Response.json(h.get('authorization')==='Bearer admin-token'?{id:'11111111-1111-4111-8111-111111111111',email:'admin@example.com'}:{id:'22222222-2222-4222-8222-222222222222',email:'other@example.com'});if(url.includes('/auth/v1/token'))return init.body.includes('correct-password')?Response.json({access_token:'admin-token',refresh_token:'refresh',expires_in:3600}):Response.json({error:'bad login'},{status:400});if(url.includes('/auth/v1/logout')||url.endsWith('/auth/v1/user'))return Response.json({});return realFetch(input,init)};
let queue=Promise.resolve();const transaction=fn=>{const next=queue.then(()=>db.transaction(async tx=>fn({unsafe:async(q,args=[])=>{if(q.includes('pg_advisory_xact_lock'))return [];const r=await tx.query(q,args);return Object.assign(r.rows,{count:r.affectedRows??r.rows.length})}})));queue=next.catch(()=>{});return next};
const origin='https://maiducphat1703.github.io';const handler=createHandler(transaction,{ALLOWED_ORIGIN:origin,SUPABASE_URL:'https://testproject.supabase.co',SUPABASE_ANON_KEY:'publishable-test',VISITOR_SECRET:'long-private-test-visitor-secret-only'});
const call=async(path,b,{admin=false,visitor='',origin:from=origin,token}={})=>{const u=new URL('https://testproject.supabase.co/functions/v1/uii-api');const p=new URL('https://local'+path);u.search=p.search;u.searchParams.set('route',p.pathname);const r=await handler(new Request(u,{method:b===undefined?'GET':'POST',headers:{Origin:from,'Content-Type':'application/json',...(admin?{Authorization:'Bearer admin-token'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(visitor?{'x-visitor-token':visitor}:{})},body:b===undefined?undefined:JSON.stringify(b)}));const body=await r.json();return {status:r.status,body,visitor:r.headers.get('x-visitor-token'),headers:r.headers}};
const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r.body));return r};
await test('Supabase: server-side permissions, private schema, guest booking, atomic approval, editing, layout and backups',async()=>{
 assert.equal((await call('/api/admin/bookings')).status,401);assert.equal((await call('/api/admin/backup')).status,401);assert.equal((await call('/api/admin/bookings',undefined,{token:'non-admin'})).status,401);assert.equal((await call('/api/settings',undefined,{origin:'https://evil.test'})).status,403);
 assert.equal((await call('/api/admin/auth',{username:'admin@example.com',password:'bad'})).status,401);assert.ok((await ok('/api/admin/auth',{username:'admin@example.com',password:'correct-password'})).body.session.access_token);
 const data={version:1,objects:[{id:'chair-1',label:'A',bookable:true,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},{id:'chair-2',label:'B',bookable:true,position:[1,0,0],rotation:[0,0,0],scale:[1,1,1]}]};
 await ok('/api/space',{name:'UII',data,revision:0},{admin:true});await ok('/api/layouts',{name:'Draft',data},{admin:true});const cfg=(await ok('/api/settings')).body;
 const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10);const guest=await ok('/api/bookings?day='+day);assert.ok(guest.visitor);const visitor=guest.visitor;const guest2=(await ok('/api/bookings?day='+day)).visitor;
 const body={requestId:'multi',resourceType:'seat',seatIds:['chair-1','chair-2'],day,startMinute:540,endMinute:600,displayName:"Phát O'Brien",organization:'UII',email:'guest@example.com',phone:'0900000000',leader:'Phát',subject:'Làm việc',description:'Mô tả',groupType:'staff',attendees:2};
 assert.equal((await call('/api/bookings',body,{visitor})).status,400);cfg.policy.seatsOpen=true;await ok('/api/settings',{policy:cfg.policy,revision:cfg.revision},{admin:true});
 await ok('/api/bookings',body,{visitor});await ok('/api/bookings',body,{visitor});assert.equal((await ok('/api/bookings?day='+day,undefined,{visitor:guest2})).body.reservations.length,0);
 assert.equal((await call('/api/bookings',{action:'cancel',id:'multi'},{visitor})).status,403);
 await ok('/api/bookings',{...body,requestId:'competing'},{visitor:guest2});const results=await Promise.all(['multi','competing'].map(id=>call('/api/admin/bookings',{action:'approve',id},{admin:true})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const publicList=(await ok('/api/bookings?day='+day,undefined,{visitor:guest2})).body;assert.equal(publicList.reservations.length,2);assert.ok(!JSON.stringify(publicList).includes('guest@example.com'));assert.equal((await call('/api/bookings',{...body,requestId:'blocked'},{visitor:guest2})).status,409);
 const weeklyDays=[14,21,28].map(offset=>new Date(Date.parse(day+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10));
 const weekly={...body,requestId:'weekly-1',day:weeklyDays[0],startMinute:420,endMinute:1320,occurrences:weeklyDays.map((d,i)=>({requestId:'weekly-'+(i+1),day:d,startMinute:420,endMinute:1320}))};
 const weeklyResult=await ok('/api/bookings',weekly,{visitor});assert.equal(weeklyResult.body.count,3,'weekly recurrence creates three separate pending requests');
 const weeklyRetry=await ok('/api/bookings',weekly,{visitor});assert.equal(weeklyRetry.body.alreadySaved,true,'weekly submission is idempotent');
 const weeklyRows=await db.query("SELECT id,day,start_minute,end_minute FROM uii.seat_bookings WHERE id LIKE 'weekly-%' ORDER BY day");assert.equal(weeklyRows.rows.length,3);assert.ok(weeklyRows.rows.every(r=>r.start_minute===420&&r.end_minute===1320),'unlimited duration respects daily opening hours but has no max-duration cap');
 assert.equal((await call('/api/space',{name:'UII',data:{version:1,objects:[]},revision:1},{admin:true})).status,409);
 const list=(await ok('/api/admin/bookings',undefined,{admin:true})).body;const row=list.bookings.find(r=>r.status==='active');assert.equal(row.display_name,"Phát O'Brien");
 const edit={action:'edit',id:row.id,expectedToken:row.edit_token,seatIds:['chair-2'],day,startMinute:615,endMinute:675,displayName:'Đã sửa',organization:'Đơn vị mới',email:'edit@example.com',phone:'0911111111',leader:'Người mới',subject:'Tiêu đề mới',description:'Nội dung mới',groupType:'faculty',adminNote:'Ghi chú'};
 await ok('/api/admin/bookings',edit,{admin:true});assert.equal((await call('/api/admin/bookings',edit,{admin:true})).status,409);
 const edited=(await db.query('SELECT * FROM uii.seat_bookings WHERE id=$1',[row.id])).rows[0];assert.equal(edited.start_minute,615);assert.equal(edited.start_slot,20.5);assert.equal(edited.email,'edit@example.com');
 await ok('/api/space',{name:'UII moved',data,revision:1},{admin:true});const snapshot=(await ok('/api/admin/backup',undefined,{admin:true})).body;assert.equal(Object.keys(snapshot.tables).length,6);assert.ok(!Object.hasOwn(snapshot.tables,'admin_users'));assert.equal(snapshot.tables.seat_bookings.length,5);
 await ok('/api/admin/bookings',{action:'cancel',id:row.id},{admin:true});assert.equal((await ok('/api/bookings?day='+day,undefined,{visitor})).body.reservations.length,0);
 assert.equal((await call('/api/bookings',{...body,requestId:'past',day:'2020-01-06'},{visitor})).status,400,'past dates are rejected even with unlimited advance booking');
 const {MEETING_TABLE}=await import('../public/booking/resources.js');const members=Array.from({length:6},(_,i)=>({id:'group-'+i,source:'chair-'+(45+i),bookable:true,position:[20+Math.cos(i*Math.PI/3),0,20+Math.sin(i*Math.PI/3)],rotation:[0,0,0],scale:[1,1,1]}));const grouped={version:1,objects:[...data.objects,{id:MEETING_TABLE,source:'hex-3',position:[20,0,20],rotation:[0,0,0],scale:[1,1,1]},...members]};await ok('/api/space',{name:'UII cluster',data:grouped,revision:2},{admin:true});assert.equal((await call('/api/bookings',{...body,requestId:'single-group',seatIds:[members[0].id],attendees:1},{visitor})).status,409);await ok('/api/bookings',{...body,requestId:'cluster',seatIds:[MEETING_TABLE],attendees:6},{visitor});await ok('/api/admin/bookings',{action:'approve',id:'cluster'},{admin:true});assert.equal((await call('/api/bookings',{...body,requestId:'cluster-overlap',seatIds:[MEETING_TABLE],attendees:6},{visitor:guest2})).status,409);
 await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM uii.seat_bookings'),/permission denied/);await db.exec('RESET ROLE');
});
await test('Regression: malformed inputs, impossible policy, pagination and full-history search',async()=>{
 assert.equal((await call('/api/admin/auth',null)).status,400);
 const cfg=(await ok('/api/settings')).body;
 assert.equal((await call('/api/settings',{revision:cfg.revision,policy:{...cfg.policy,openMinute:420,closeMinute:450,minMinutes:60}},{admin:true})).status,400);
 const object={id:'chair-regression',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 for(const objects of [[null],[object,object],[{...object,id:''}]]){
  assert.equal((await call('/api/layouts',{name:'Invalid draft',data:{version:1,objects}},{admin:true})).status,400);
 }
 const invalidDay=await call('/api/admin/bookings?day=2026-02-30',undefined,{admin:true});assert.equal(invalidDay.status,400);
 assert.equal((await call('/api/admin/bookings?offset=-1',undefined,{admin:true})).status,400);
 // More than the former silent 300-row cap; use cloned synthetic rows only in local PostgreSQL.
 await db.exec("INSERT INTO uii.seat_bookings SELECT (jsonb_populate_record(NULL::uii.seat_bookings,to_jsonb(b)||jsonb_build_object('id','pagination-'||n,'display_name','Archive QA '||n,'subject',CASE WHEN n=1 THEN 'Unique archive needle' ELSE 'Pagination' END,'created_at','2020-01-01T00:00:00Z'))).* FROM (SELECT * FROM uii.seat_bookings LIMIT 1) b CROSS JOIN generate_series(1,305) n");
 const seen=[];let offset=0;for(let i=0;i<10;i++){
  const page=(await ok('/api/admin/bookings?offset='+offset,undefined,{admin:true})).body;
  assert.ok(page.bookings.length<=100);seen.push(...page.bookings.map(b=>b.id));if(!page.hasMore)break;offset+=page.limit;
 }
 assert.equal(new Set(seen).size,seen.length);assert.ok(seen.includes('pagination-1'));assert.ok(seen.includes('pagination-305'));
 const search=(await ok('/api/admin/bookings?search=unique%20archive%20needle',undefined,{admin:true})).body;assert.deepEqual(search.bookings.map(b=>b.id),['pagination-1']);
});
await test('Regression: repeated booking is atomic if a later week conflicts',async()=>{
 const visitor=(await ok('/api/bookings?day='+new Date(Date.now()+86400000).toISOString().slice(0,10))).visitor;
 const {MEETING_TABLE}=await import('../public/booking/resources.js');
 const days=[14,21,28].map(n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10));
 const base={resourceType:'seat',seatIds:[MEETING_TABLE],attendees:6,displayName:'Local recurrence QA',organization:'QA',groupType:'other',email:'qa@example.com',phone:'0000000000',leader:'QA',subject:'Atomic recurrence',description:'',startMinute:900,endMinute:960};
 await ok('/api/bookings',{...base,requestId:'series-blocker',day:days[1]},{visitor});await ok('/api/admin/bookings',{id:'series-blocker',action:'approve'},{admin:true});
 const occurrences=days.map((day,i)=>({requestId:'atomic-series-'+i,day,startMinute:900,endMinute:960}));
 const conflict=await call('/api/bookings',{...base,requestId:occurrences[0].requestId,day:days[0],occurrences},{visitor});assert.equal(conflict.status,409);assert.equal(conflict.body.conflictDay,days[1]);
 assert.equal((await db.query("SELECT id FROM uii.seat_bookings WHERE id LIKE 'atomic-series-%'")).rows.length,0);
});
await test('Security: enforce JSON and streamed byte limits, minimize guest data and protect every admin write',async()=>{
 for(const path of ['/api/settings','/api/layouts','/api/space','/api/admin/bookings'])assert.equal((await call(path,{})).status,401,path);
 const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10),guest=await ok('/api/bookings?day='+day);
 const privacyDay=new Date(Date.now()+40*86400000).toISOString().slice(0,10);
 await ok('/api/bookings',{requestId:'privacy-guest',resourceType:'seat',seatIds:['chair-1'],day:privacyDay,startMinute:540,endMinute:600,attendees:1,displayName:'Private name',organization:'Private organization',email:'guest@example.com',phone:'0000000000',leader:'Private leader',subject:'Private purpose',description:'Private description',groupType:'other'},{visitor:guest.visitor});
 const publicBody=(await ok('/api/bookings?day='+privacyDay,undefined,{visitor:guest.visitor})).body;
 assert.deepEqual(publicBody.mine,[{id:'privacy-guest',status:'pending'}]);
 assert.ok(!JSON.stringify(publicBody).includes('guest@example.com'));
 const tampered=guest.visitor.slice(0,-10)+'AAAAAAAAAA';const forged=(await ok('/api/bookings?day='+day,undefined,{visitor:tampered})).body;assert.deepEqual(forged.mine,[]);
 const object={id:'safe-chair',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
 for(const field of [{label:{}},{source:{}},{bookable:'true'},{color:'url(javascript:alert(1))'},{deleted:'false'}]){
  for(const path of ['/api/layouts','/api/space'])assert.equal((await call(path,{name:'Invalid metadata',revision:3,data:{version:1,objects:[{...object,...field}]}},{admin:true})).status,400,path);
 }
 const url='https://testproject.supabase.co/functions/v1/uii-api?route=/api/admin/auth';
 const simple=await handler(new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:'{}'}));assert.equal(simple.status,415);
 // Missing Content-Length cannot bypass the byte cap, including multibyte payloads.
 const huge=await handler(new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({padding:'ắ'.repeat(24000)})}));assert.equal(huge.status,413);
 assert.equal(huge.headers.get('x-content-type-options'),'nosniff');assert.equal(huge.headers.get('referrer-policy'),'no-referrer');
 assert.equal((await call('/api/admin/bookings',undefined,{token:'x'.repeat(9000)})).status,401);
 const injected=(await ok('/api/admin/bookings?search='+encodeURIComponent("' OR 1=1 --"),undefined,{admin:true})).body;assert.deepEqual(injected.bookings,[]);
 const guestId='visitor:'+JSON.parse(Buffer.from(guest.visitor.split('.')[0],'base64url')).id;
 await db.query("INSERT INTO uii.seat_bookings SELECT (jsonb_populate_record(NULL::uii.seat_bookings,to_jsonb(b)||jsonb_build_object('id','quota-'||n,'user_id',$1::text,'created_at',$2::text))).* FROM (SELECT * FROM uii.seat_bookings WHERE id='privacy-guest') b CROSS JOIN generate_series(1,120) n",[guestId,new Date().toISOString()]);
 const request={requestId:'quota-overflow',resourceType:'seat',seatIds:['chair-1'],day:privacyDay,startMinute:540,endMinute:600,attendees:1,displayName:'QA',organization:'QA',email:'qa@example.com',phone:'0000000000',leader:'QA',subject:'QA',description:'',groupType:'other'};
 const limited=await call('/api/bookings',request,{visitor:guest.visitor});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'3600');
 const retry=await ok('/api/bookings',{...request,requestId:'privacy-guest'},{visitor:guest.visitor});assert.equal(retry.body.alreadySaved,true,'a saved request can be retried even after quota is reached');

});
await test('Admin operations: six-row pages, inclusive date range, status transitions, stale tokens and deletion',async()=>{
 const all=(await ok('/api/admin/bookings?limit=6',undefined,{admin:true})).body;
 assert.equal(all.bookings.length,6);assert.ok(all.totalCount>6);assert.equal(all.hasMore,true);
 const next=(await ok('/api/admin/bookings?limit=6&offset=6',undefined,{admin:true})).body;
 assert.ok(next.bookings.every(b=>!all.bookings.some(a=>a.id===b.id)));
 const row=all.bookings[0];
 const ranged=(await ok('/api/admin/bookings?limit=6&from='+row.day+'&to='+row.day,undefined,{admin:true})).body;
 assert.ok(ranged.bookings.every(b=>b.day===row.day));assert.ok(ranged.totalCount>0);
 for(const q of ['limit=0','limit=101','from=2026-02-30','from=2026-12-31&to=2026-01-01'])assert.equal((await call('/api/admin/bookings?'+q,undefined,{admin:true})).status,400);
 await db.query("INSERT INTO uii.seat_bookings SELECT (jsonb_populate_record(NULL::uii.seat_bookings,to_jsonb(b)||jsonb_build_object('id','ops-delete','status','cancelled'))).* FROM uii.seat_bookings b LIMIT 1");
 let item=(await ok('/api/admin/bookings?search=ops-delete',undefined,{admin:true})).body.bookings[0];
 assert.equal((await call('/api/admin/bookings',{id:item.id,action:'delete',expectedToken:item.edit_token},{token:'non-admin'})).status,401);
 await ok('/api/admin/bookings',{id:item.id,action:'reopen',expectedToken:item.edit_token},{admin:true});
 assert.equal((await call('/api/admin/bookings',{id:item.id,action:'delete',expectedToken:item.edit_token},{admin:true})).status,409);
 item=(await ok('/api/admin/bookings?search=ops-delete',undefined,{admin:true})).body.bookings[0];assert.equal(item.status,'pending');
 await ok('/api/admin/bookings',{id:item.id,action:'reject',expectedToken:item.edit_token},{admin:true});
 item=(await ok('/api/admin/bookings?search=ops-delete',undefined,{admin:true})).body.bookings[0];assert.equal(item.status,'rejected');
 assert.equal((await call('/api/admin/bookings',{id:item.id,action:'delete'},{admin:true})).status,409);
 await ok('/api/admin/bookings',{id:item.id,action:'delete',expectedToken:item.edit_token},{admin:true});
 assert.equal((await ok('/api/admin/bookings?search=ops-delete',undefined,{admin:true})).body.totalCount,0);
 const tail=(await ok('/api/admin/bookings?limit=6&offset=999999',undefined,{admin:true})).body;assert.ok(tail.bookings.length<=6);assert.ok(tail.bookings.length>0);assert.equal(tail.hasMore,false);
});
await db.close();globalThis.fetch=realFetch;

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
await test('Browser bridge: correct API paths, session refresh, guest tokens and logout',async()=>{
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};const sessionStorage=storage(),localStorage=storage(),calls=[];
 const original=async(input,options)=>{const req=new Request(input,options);const u=new URL(req.url);options={method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:await req.text()};calls.push({u,options});if(u.pathname.endsWith('/token'))return Response.json({access_token:'renewed',refresh_token:'refresh2',expires_in:3600});if(u.searchParams.get('route')==='/api/admin/auth'&&options.method==='POST'){const b=JSON.parse(options.body);return Response.json(b.action==='logout'?{ok:true,clearSession:true}:{ok:true,session:{access_token:'first',refresh_token:'refresh',expires_at:1}})}return Response.json({ok:true},{headers:{'x-visitor-token':'signed-guest'}})};
 const window={UII_CONFIG:{url:'https://testproject.supabase.co',key:'sb_publishable_example',base:'/uii_schedule_1502/'},fetch:original};const ctx={window,fetch:(...a)=>window.fetch(...a),sessionStorage,localStorage,URL,Request,Headers,Response,location:{href:'https://maiducphat1703.github.io/uii_schedule_1502/booking/',origin:'https://maiducphat1703.github.io'},document:{addEventListener(){}},console,setTimeout};vm.runInNewContext(fs.readFileSync('public/runtime.js','utf8'),ctx);
 await window.fetch('/api/bookings?day=2020-01-06');assert.equal(calls[0].u.searchParams.get('day'),'2020-01-06');assert.equal(calls[0].u.searchParams.get('route'),'/api/bookings');assert.equal(localStorage.getItem('uii1502-visitor'),'signed-guest');
 await window.fetch('/api/admin/auth',{method:'POST',body:JSON.stringify({username:'admin@example.com',password:'test'})});await window.fetch('/api/admin/bookings');assert.equal(calls.at(-1).options.headers.get('authorization'),'Bearer renewed');assert.equal(calls.at(-1).options.headers.get('x-visitor-token'),'signed-guest');assert.equal(calls.filter(c=>c.u.pathname.endsWith('/token')).length,1);
 await window.fetch('/api/admin/auth',{method:'POST',body:JSON.stringify({action:'logout'})});assert.equal(sessionStorage.getItem('uii1502-session'),null);
 await window.fetch('/uii_schedule_1502/api/space');assert.equal(calls.at(-1).u.searchParams.get('route'),'/api/space');
});

await test('Expired session does not block guests or re-login; Request inputs retain body and abort signal',async()=>{
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
 const sessionStorage=storage(),localStorage=storage(),calls=[];
 sessionStorage.setItem('uii1502-session',JSON.stringify({access_token:'expired',refresh_token:'revoked',expires_at:1}));
 const original=async(input,options)=>{const req=new Request(input,options);calls.push(req);if(req.url.includes('/auth/v1/token'))return Response.json({error:'revoked'},{status:400});return Response.json({ok:true})};
 const window={UII_CONFIG:{url:'https://testproject.supabase.co',key:'public-test',base:'/uii_schedule_1502/'},fetch:original};
 const ctx={window,fetch:(...a)=>window.fetch(...a),sessionStorage,localStorage,URL,Request,Headers,Response,location:{href:'https://maiducphat1703.github.io/uii_schedule_1502/booking/',origin:'https://maiducphat1703.github.io'},document:{addEventListener(){}},console,setTimeout};
 vm.runInNewContext(fs.readFileSync('public/runtime.js','utf8'),ctx);
 assert.equal((await window.fetch('/api/bookings?day=2026-11-10')).status,200);
 assert.equal(sessionStorage.getItem('uii1502-session'),null);
 assert.equal(calls.at(-1).headers.get('authorization'),null);
 const controller=new AbortController();const req=new Request('https://maiducphat1703.github.io/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:'retry-123'}),signal:controller.signal});
 await window.fetch(req);const forwarded=calls.at(-1);assert.equal(forwarded.method,'POST');assert.deepEqual(await forwarded.json(),{requestId:'retry-123'});controller.abort();assert.equal(forwarded.signal.aborted,true);
 await window.fetch('/api/admin/auth',{method:'POST',body:JSON.stringify({username:'test@example.com',password:'test-only'})});assert.equal(calls.at(-1).method,'POST');
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
await test('Deployment build blocks secret keys and installs a restrictive browser policy',()=>{
 const env={...process.env,SUPABASE_URL:'https://uitestproject.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_secret_never_bundle'};
 assert.throws(()=>execFileSync(process.execPath,['scripts/build.mjs'],{env,stdio:'pipe'}));
 env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_build_security_test';execFileSync(process.execPath,['scripts/build.mjs'],{env,stdio:'pipe'});
 for(const file of ['index.html','booking/index.html','admin/index.html','admin/login/index.html','studio/index.html']){
  const html=fs.readFileSync('dist/'+file,'utf8');
  assert.ok(html.includes('http-equiv="Content-Security-Policy"'));
  assert.ok(html.includes("script-src 'self'"));assert.ok(!html.includes("script-src 'self' 'unsafe-inline'"));
  assert.ok(html.includes("object-src 'none'"));assert.ok(html.includes("base-uri 'self'"));assert.ok(html.includes('name="referrer" content="no-referrer"'));
  assert.ok(html.includes("connect-src 'self' https://uitestproject.supabase.co"));
  assert.ok(!html.includes('sb_secret_never_bundle'));
 }
 const code=fs.readFileSync('dist/booking/seats.js','utf8');assert.match(code,/day-overview\.js\?v=[a-f0-9]+/);
});

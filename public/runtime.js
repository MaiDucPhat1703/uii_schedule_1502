(()=>{
 const config=window.UII_CONFIG,originalFetch=window.fetch.bind(window);
 const key='uii1502-session',visitorKey='uii1502-visitor';
 const read=(storage,key)=>{try{return storage.getItem(key)}catch{return null}},write=(storage,key,value)=>{try{if(value===null)storage.removeItem(key);else storage.setItem(key,value)}catch{}};
 let session;try{session=JSON.parse(read(sessionStorage,key)||'null')}catch{session=null}
 let refreshTask=null;
 async function validSession(){if(!session)return null;if(session.expires_at>Date.now()/1000+60)return session;
 if(!refreshTask)refreshTask=(async()=>{try{const r=await originalFetch(config.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',signal:AbortSignal.timeout(20000),redirect:'error',credentials:'omit',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok){if([400,401,403].includes(r.status)){session=null;write(sessionStorage,key,null)}throw Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')}const b=await r.json();session={access_token:b.access_token,refresh_token:b.refresh_token,expires_at:Math.floor(Date.now()/1000)+b.expires_in};write(sessionStorage,key,JSON.stringify(session));return session}finally{refreshTask=null}})();return refreshTask;}
 window.fetch=async(input,options={})=>{
 const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const url=new URL(raw,location.href);let path=url.pathname;
 if(path.startsWith(config.base+'api/'))path='/'+path.slice(config.base.length);
 if(!path.startsWith('/api/')||url.origin!==location.origin)return originalFetch(input,options);
 // A rejected refresh must not prevent login, logout or public guest requests.
 let s;try{s=await validSession()}catch(error){if(session)throw error;s=null}
 const request=new Request(input instanceof Request?input:url,options);
 const headers=new Headers(request.headers);headers.set('apikey',config.key);if(s)headers.set('Authorization','Bearer '+s.access_token);const visitor=read(localStorage,visitorKey);if(visitor)headers.set('x-visitor-token',visitor);
 const endpoint=new URL(config.url+'/functions/v1/uii-api');endpoint.search=url.search;endpoint.searchParams.set('route',path);
 const r = await originalFetch(endpoint, {
  method: request.method,
  headers,
  credentials: 'omit',
  signal: request.signal,
  redirect: request.redirect,
  body: request.body === null ? undefined : await request.arrayBuffer(),
});
 const issued=r.headers.get('x-visitor-token');if(issued)write(localStorage,visitorKey,issued);
 if(path==='/api/admin/auth'&&request.method==='POST'){const body=await r.clone().json();if(body.session){session=body.session;write(sessionStorage,key,JSON.stringify(session))}if(body.clearSession){session=null;write(sessionStorage,key,null)}}
 return r;
 };
 document.addEventListener('click',async e=>{const a=e.target.closest?.('a');if(!a)return;const url=new URL(a.href,location.href);if(url.origin!==location.origin||!url.pathname.endsWith('/api/admin/backup'))return;e.preventDefault();try{const r=await fetch('/api/admin/backup');if(!r.ok)throw Error((await r.json()).error||'Chưa tải được bản sao');const blob=await r.blob(),download=document.createElement('a');download.href=URL.createObjectURL(blob);download.download='uii-backup-'+new Date().toISOString().slice(0,10)+'.json';download.click();setTimeout(()=>URL.revokeObjectURL(download.href),1000)}catch(error){alert(error.message)}});
})();

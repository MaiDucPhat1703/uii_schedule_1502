import {env} from './runtime.ts';
const encoder=new TextEncoder();
const to64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const from64=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function key(){return crypto.subtle.importKey('raw',encoder.encode(env.VISITOR_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
export async function sign(p:any){const body=to64(encoder.encode(JSON.stringify(p)));return body+'.'+to64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(),encoder.encode(body))))}
export async function visitor(r:Request){const token=r.headers.get('x-visitor-token');if(token)try{const [body,sig,...extra]=token.split('.');if(!extra.length&&await crypto.subtle.verify('HMAC',await key(),from64(sig),encoder.encode(body))){const p=JSON.parse(new TextDecoder().decode(from64(body)));if(p.purpose==='visitor'&&p.exp>Date.now()&&typeof p.id==='string')return {userId:'visitor:'+p.id,cookie:null}}}catch{}
 const id=crypto.randomUUID(),value=await sign({purpose:'visitor',id,exp:Date.now()+90*86400000});env.visitorToken=value;return {userId:'visitor:'+id,cookie:null};}
export async function getAdmin(r:Request){
 if(env.adminChecked)return env.admin??null;env.adminChecked=true;
 const bearer=r.headers.get('authorization');if(!bearer?.startsWith('Bearer '))return null;
 const response=await fetch(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:bearer}});if(!response.ok)return null;const user=await response.json();
 if(typeof user.id!=='string')return null;const row=await env.DB.prepare('SELECT user_id FROM admin_users WHERE user_id=?').bind(user.id).first();
 env.admin=row?{userId:user.id,username:user.email}:null;return env.admin;
}
export function sameOrigin(r:Request){return r.headers.get('origin')===env.ALLOWED_ORIGIN}

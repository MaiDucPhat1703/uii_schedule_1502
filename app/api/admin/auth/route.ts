import {env} from '../../../runtime.ts';import {getAdmin,sameOrigin} from '../../../admin-auth.ts';
const json=(b:unknown,s=200)=>Response.json(b,{status:s});
async function auth(path:string,body:any,token?:string,method='POST'){return fetch(env.SUPABASE_URL+'/auth/v1/'+path,{method,headers:{apikey:env.SUPABASE_ANON_KEY,'Content-Type':'application/json',...(token?{Authorization:token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error',credentials:'omit'})}
export async function GET(r:Request){const user=await getAdmin(r);return json({authenticated:!!user,username:user?.username})}
export async function POST(r:Request){if(!sameOrigin(r))return json({error:'Yêu cầu không hợp lệ.'},403);let b:any;try{b=await r.json()}catch{return json({error:'Dữ liệu không hợp lệ.'},400)}
 if(!b||typeof b!=='object'||Array.isArray(b))return json({error:'Dữ liệu không hợp lệ.'},400);
 if(b.action==='logout'){const token=r.headers.get('authorization');if(token)await auth('logout',{},token);return json({ok:true,clearSession:true})}
 if(b.action==='password'){const admin=await getAdmin(r);if(!admin)return json({error:'Vui lòng đăng nhập admin.'},401);if(typeof b.newPassword!=='string'||b.newPassword.length<12||b.newPassword.length>200||typeof b.currentPassword!=='string')return json({error:'Mật khẩu mới cần từ 12 đến 200 ký tự.'},400);
 const verified=await auth('token?grant_type=password',{email:admin.username,password:b.currentPassword});if(!verified.ok)return json({error:'Mật khẩu hiện tại không đúng.'},403);
 const changed=await auth('user',{password:b.newPassword},r.headers.get('authorization')!,'PUT');if(!changed.ok)return json({error:'Chưa đổi được mật khẩu.'},400);await auth('logout',{},r.headers.get('authorization')!);return json({ok:true,clearSession:true})}
 if(typeof b.username!=='string'||typeof b.password!=='string'||b.username.length>255||b.password.length>200)return json({error:'Nhập email và mật khẩu admin.'},400);
 const result=await auth('token?grant_type=password',{email:b.username.trim(),password:b.password});if(!result.ok)return json({error:'Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được xác nhận.'},401);const session=await result.json();
 const check=new Request(r.url,{headers:new Headers(r.headers)});check.headers.set('authorization','Bearer '+session.access_token);env.adminChecked=false;const admin=await getAdmin(check);if(!admin){await auth('logout',{},'Bearer '+session.access_token);return json({error:'Tài khoản chưa được cấp quyền quản trị.'},403)}
 return json({ok:true,session:{access_token:session.access_token,refresh_token:session.refresh_token,expires_at:Math.floor(Date.now()/1000)+session.expires_in}});
}

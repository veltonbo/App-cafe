const KEY='fazenda2e-react-auth';
export type Auth={appToken:string,email:string,profile:any,expiresAt?:number};
async function parse(r:Response){const text=await r.text();let x:any={};try{x=text?JSON.parse(text):{}}catch{x={error:text||'Resposta inválida do servidor.'}}if(!r.ok)throw new Error((x.error||x.detail||('Falha HTTP '+r.status+'.'))+' [HTTP '+r.status+']');return x}
async function request(path:string,init:RequestInit={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);try{return await fetch(path,{...init,cache:'no-store',credentials:'same-origin',signal:c.signal})}catch(e:any){if(e?.name==='AbortError')throw new Error('O servidor demorou para responder.');throw new Error('Não foi possível conectar ao servidor.')}finally{clearTimeout(t)}}
function persist(a:Auth|null){if(a)localStorage.setItem(KEY,JSON.stringify(a));else localStorage.removeItem(KEY)}
export function saved():Auth|null{try{const a=JSON.parse(localStorage.getItem(KEY)||'null');if(!a?.appToken)return null;if(a.expiresAt&&a.expiresAt<Date.now()){persist(null);return null}return a}catch{return null}}
export function clear(){persist(null)}
export async function login(email:string,password:string){const s=await parse(await request('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}));const token=String(s.token||'');if(!token)throw new Error('O servidor não criou a sessão.');const me=await parse(await request('/api/users?scope=me',{headers:{Authorization:'Bearer '+token}}));const a:Auth={appToken:token,email:s.user?.email||email,profile:me.user,expiresAt:Number(s.expires_at||0)||undefined};persist(a);return a}
export async function restore(){const a=saved();if(!a)return null;try{const me=await parse(await request('/api/users?scope=me',{headers:{Authorization:'Bearer '+a.appToken}}));const next={...a,profile:me.user};persist(next);return next}catch{persist(null);return null}}
export async function logout(a?:Auth|null){try{await request('/api/session',{method:'DELETE',headers:a?.appToken?{Authorization:'Bearer '+a.appToken}:{}})}catch{}persist(null)}
function h(a:Auth){return{Authorization:'Bearer '+a.appToken,'Content-Type':'application/json'}}
export async function users(a:Auth){return parse(await request('/api/users',{headers:h(a)}))}
export async function createUser(a:Auth,u:any){return parse(await request('/api/users',{method:'POST',headers:h(a),body:JSON.stringify(u)}))}
export async function updateUser(a:Auth,u:any){return parse(await request('/api/users',{method:'PATCH',headers:h(a),body:JSON.stringify(u)}))}

export async function userAudit(a:Auth){return parse(await request('/api/users?scope=audit',{headers:h(a)}))}

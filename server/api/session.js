import { resolveAccess } from './_rbac.js';
const firebaseApiKey='AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc';
import {
  applyCors,
  authorize,
  clearControlSession,
  issueAppBearerSession,
  issueControlSession,
  authPrincipal,
  verifyFirebaseIdToken
} from './_tuya.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();

  if(req.method==='GET' && String(req.query?.probe||'')==='1') return res.status(200).json({ok:true,probe:'fazenda2e-auth',ts:Date.now()});

  if(req.method==='POST'){
    console.log('[AUTH_TRACE]',new Date().toISOString(),'session_post_received',{email:String(req.body?.email||'').trim().toLowerCase(),ua:String(req.headers?.['user-agent']||'').slice(0,120)});
    const email=String(req.body?.email||'').trim();
    const password=String(req.body?.password||'');
    if(email&&password){
      try{
        const key=String(process.env.FIREBASE_API_KEY||process.env.VITE_FIREBASE_API_KEY||firebaseApiKey).trim();
        if(!key)return res.status(503).json({ok:false,error:'Autenticação indisponível.'});
        const endpoint='https://identitytoolkit.googleapis.com/v1/accounts:'+'signInWithPassword?key='+encodeURIComponent(key);
        const authResponse=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
        const authBody=await authResponse.json().catch(()=>({}));
        if(!authResponse.ok||!authBody?.idToken){const code=String(authBody?.error?.message||'AUTH_FAILED');console.warn('[AUTH_TRACE]',new Date().toISOString(),'firebase_signin_failed',code);return res.status(401).json({ok:false,error:'Falha no Firebase: '+code,stage:'firebase-signin'});}
        const user=await verifyFirebaseIdToken(authBody.idToken);
        const session=issueAppBearerSession(user);
        console.log('[AUTH_TRACE]',new Date().toISOString(),'firebase_signin_ok',{uid:user.uid,email:user.email});return res.status(200).json({ok:true,session:true,auth:'firebase-proxy',token:session.token,idToken:authBody.idToken,expires_at:session.expires_at,user:{...session.user,access:resolveAccess(user)}});
      }catch{return res.status(503).json({ok:false,error:'Falha temporária na autenticação.'});}
    }
    const firebaseIdToken=String(req.body?.idToken||'').trim();
    if(firebaseIdToken){
      try{
        const user=await verifyFirebaseIdToken(firebaseIdToken);
        const session=issueAppBearerSession(user);
        return res.status(200).json({
          ok:true,
          session:true,
          auth:'firebase',
          token:session.token,
          expires_at:session.expires_at,
          user:{...session.user,access:resolveAccess(user)}
        });
      }catch(error){
        return res.status(401).json({ok:false,error:'Login do Firebase inválido.',detail:error?.message||String(error)});
      }
    }

    // Accept either the legacy control bearer, a valid Firebase app bearer, or an
    // already-valid secure cookie. This lets the browser exchange the short-lived
    // app bearer created by Firebase login for the HttpOnly control-session cookie.
    if(!authorize(req,res))return;
    const principal=authPrincipal(req)||{};
    const session=issueControlSession(res,principal);
    return res.status(200).json({ok:true,session:true,auth:'secure-cookie',expires_at:session.expires_at,access:resolveAccess(principal)});
  }

  if(req.method==='GET'){
    if(String(req.query?.probe||'')==='1'){console.log('[AUTH_TRACE]',new Date().toISOString(),'probe_received');return res.status(200).json({ok:true,probe:'fazenda2e-auth',ts:Date.now()});}
    if(!authorize(req,res))return;
    const principal=authPrincipal(req)||{};
    return res.status(200).json({ok:true,session:true,access:resolveAccess(principal)});
  }

  if(req.method==='DELETE'){
    clearControlSession(res);
    return res.status(200).json({ok:true,session:false});
  }

  return res.status(405).json({ok:false,error:'Método não permitido.'});
}

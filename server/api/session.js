import {
  applyCors,
  authorize,
  authorizeControlToken,
  clearControlSession,
  issueAppBearerSession,
  issueControlSession,
  verifyFirebaseIdToken
} from './_tuya.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();

  if(req.method==='POST'){
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
          user:session.user
        });
      }catch(error){
        return res.status(401).json({ok:false,error:'Login do Firebase inválido.',detail:error?.message||String(error)});
      }
    }

    if(!authorizeControlToken(req,res))return;
    const session=issueControlSession(res);
    return res.status(200).json({ok:true,session:true,auth:'legacy',expires_at:session.expires_at});
  }

  if(req.method==='GET'){
    if(!authorize(req,res))return;
    return res.status(200).json({ok:true,session:true});
  }

  if(req.method==='DELETE'){
    clearControlSession(res);
    return res.status(200).json({ok:true,session:false});
  }

  return res.status(405).json({ok:false,error:'Método não permitido.'});
}

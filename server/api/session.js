import {
  applyCors,
  authorize,
  authorizeControlToken,
  clearControlSession,
  issueControlSession
} from './_tuya.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();

  if(req.method==='POST'){
    if(!authorizeControlToken(req,res))return;
    const session=issueControlSession(res);
    return res.status(200).json({ok:true,session:true,expires_at:session.expires_at});
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

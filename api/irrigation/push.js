import { applyCors, authorize } from '../_tuya.js';
import {
  getVapidPublicKey,
  listPushSubscriptions,
  removePushSubscription,
  savePushSubscription,
  sendPushAlert
} from './_push.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;

  try{
    if(req.method==='GET'){
      const list=await listPushSubscriptions();
      return res.status(200).json({
        ok:true,
        publicKey:getVapidPublicKey(),
        subscriptions:list.length
      });
    }

    if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método não permitido.'});
    const action=String(req.body?.action||'subscribe');

    if(action==='subscribe'){
      const subscription=req.body?.subscription;
      const key=await savePushSubscription(subscription,{
        userAgent:req.headers['user-agent']||'',
        platform:req.body?.platform||''
      });
      return res.status(200).json({ok:true,key,publicKey:getVapidPublicKey()});
    }

    if(action==='unsubscribe'){
      await removePushSubscription(req.body?.endpoint||'');
      return res.status(200).json({ok:true});
    }

    if(action==='test'){
      const result=await sendPushAlert({
        title:'Fazenda 2E • Teste de alerta',
        body:'As notificações da Central de Irrigação estão funcionando.',
        tag:'fazenda2e-test',
        url:'/irrigacao/central/'
      });
      return res.status(200).json({ok:true,...result});
    }

    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }catch(error){
    return res.status(502).json({ok:false,error:error?.message||'Falha nas notificações.'});
  }
}

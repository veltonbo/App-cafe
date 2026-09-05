import { getRun, start } from 'workflow/api';
import { applyCors, authorize, ensureConfig } from '../_tuya.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { prepareServerPulse, stopServerPulse } from './_seconds.js';
import { viveiroPulseWorkflow } from '../../../workflows/viveiro-pulse.js';

function statusIsActive(status){
  return !['completed','failed','cancelled','canceled'].includes(String(status||'').toLowerCase());
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res)||!ensureConfig(res))return;

  try{
    if(req.method==='GET'){
      const runId=String(req.query?.run_id||'').trim();
      if(!runId){
        return res.status(200).json({
          ok:true,
          state:{enabled:false,engine:'vercel_workflow',phase:'idle'}
        });
      }

      try{
        const run=getRun(runId);
        const status=await run.status;
        return res.status(200).json({
          ok:true,
          state:{
            enabled:statusIsActive(status),
            engine:'vercel_workflow',
            workflow_run_id:runId,
            phase:String(status||'unknown')
          }
        });
      }catch(error){
        return res.status(200).json({
          ok:true,
          state:{
            enabled:false,
            engine:'vercel_workflow',
            workflow_run_id:runId,
            phase:'not_found',
            error:error?.message||String(error)
          }
        });
      }
    }

    const action=String(req.body?.action||'configure');

    if(action==='configure'){
      const weather=await fetchWeatherSnapshot().catch(()=>null);
      if(weather?.metrics?.rainDetected){
        return res.status(423).json({
          ok:false,
          blocked:true,
          error:'A Weather2-2 está detectando chuva. O modo rápido não será iniciado agora.'
        });
      }

      const state=await prepareServerPulse({
        onSeconds:req.body?.on_seconds,
        offSeconds:req.body?.off_seconds,
        resumeDelayMinutes:req.body?.resume_delay_minutes
      });

      try{
        const workflowInput={
          on_seconds:state.on_seconds,
          off_seconds:state.off_seconds,
          resume_delay_minutes:state.resume_delay_minutes,
          start_minutes:state.start_minutes,
          end_minutes:state.end_minutes,
          days_mask:state.days_mask
        };
        const run=await start(viveiroPulseWorkflow,[workflowInput]);
        const runId=String(run?.runId||run?.id||run?.workflowRunId||'').trim();
        if(!runId)throw new Error('A Vercel não retornou o identificador da execução.');

        return res.status(200).json({
          ok:true,
          workflow_started:true,
          workflow_run_id:runId,
          state:{
            ...state,
            workflow_run_id:runId,
            phase:'running'
          }
        });
      }catch(error){
        await stopServerPulse({
          nativeCycleRaw:state.native_cycle_raw,
          restoreNative:true
        }).catch(()=>null);
        throw new Error('Não foi possível iniciar o controlador de pulsos no servidor. '+(error?.message||String(error)));
      }
    }

    if(action==='disable'){
      const runId=String(req.body?.run_id||'').trim();
      let cancelError=null;

      if(runId){
        try{
          const run=getRun(runId);
          if(typeof run.cancel==='function')await run.cancel();
          else cancelError='A versão atual do Workflow não expôs cancel() para esta execução.';
        }catch(error){
          cancelError=error?.message||String(error);
        }
      }

      const stopped=await stopServerPulse({
        nativeCycleRaw:String(req.body?.native_cycle_raw||''),
        restoreNative:req.body?.restore_native!==false
      });

      return res.status(200).json({
        ok:true,
        state:{
          ...stopped,
          workflow_run_id:runId||null,
          cancel_error:cancelError
        }
      });
    }

    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }catch(error){
    const message=error?.message||'Falha no modo rápido em segundos.';
    return res.status(502).json({
      ok:false,
      error:message,
      detail:message
    });
  }
}

import { spawn } from 'node:child_process';
import path from 'node:path';

const MARKER='__F2E_PY_ENGINE__';

function pythonBin(){
  return String(process.env.SMARTLIFE_PYTHON_BIN||'python3').trim()||'python3';
}

class PythonIrrigationEngine{
  constructor(){
    this.child=null;
    this.buffer='';
    this.stderr='';
    this.current=null;
    this.seq=0;
    this.queue=Promise.resolve();
  }

  ensure(){
    if(this.child&&!this.child.killed)return this.child;
    const child=spawn(pythonBin(),[path.join(process.cwd(),'smartlife','controller_engine.py')],{
      cwd:process.cwd(),
      env:{...process.env,PYTHONIOENCODING:'utf-8'},
      stdio:['pipe','pipe','pipe']
    });
    this.child=child;
    this.buffer='';
    this.stderr='';
    child.stdout.on('data',chunk=>this.onData(chunk));
    child.stderr.on('data',chunk=>{this.stderr=(this.stderr+chunk.toString('utf8')).slice(-4000)});
    child.on('error',error=>this.fail(new Error('Motor Python indisponível: '+(error?.message||String(error)))));
    child.on('close',code=>{
      const had=this.current;
      this.child=null;
      if(had)this.fail(new Error('Motor Python encerrou: '+(this.stderr.trim()||('código '+code))));
    });
    return child;
  }

  onData(chunk){
    this.buffer+=chunk.toString('utf8');
    for(;;){
      const idx=this.buffer.indexOf('\n');
      if(idx<0)break;
      const line=this.buffer.slice(0,idx).trim();
      this.buffer=this.buffer.slice(idx+1);
      if(!line.startsWith(MARKER))continue;
      let env;
      try{env=JSON.parse(line.slice(MARKER.length))}catch{continue}
      const cur=this.current;
      if(!cur||String(env?.request_id)!==String(cur.id))continue;
      clearTimeout(cur.timer);
      this.current=null;
      if(!env?.result?.ok)return cur.reject(new Error(env?.result?.error||'Falha no motor Python.'));
      cur.resolve(env.result);
    }
  }

  fail(error){
    const cur=this.current;
    if(!cur)return;
    clearTimeout(cur.timer);
    this.current=null;
    cur.reject(error);
  }

  decide(payload,{timeoutMs=2500}={}){
    const exec=()=>new Promise((resolve,reject)=>{
      const child=this.ensure();
      const id='pyeng-'+Date.now()+'-'+(++this.seq);
      const timer=setTimeout(()=>{
        if(this.current?.id!==id)return;
        this.current=null;
        try{child.kill('SIGKILL')}catch{}
        reject(new Error('Motor Python excedeu o tempo limite.'));
      },Math.max(1000,Number(timeoutMs)||2500));
      timer.unref?.();
      this.current={id,resolve,reject,timer};
      child.stdin.write(JSON.stringify({request_id:id,payload})+'\n',error=>{
        if(!error)return;
        if(this.current?.id===id){clearTimeout(timer);this.current=null}
        reject(error);
      });
    });
    const job=this.queue.then(exec,exec);
    this.queue=job.catch(()=>null);
    return job;
  }

  stop(){
    try{this.child?.kill('SIGTERM')}catch{}
    this.child=null;
  }
}

const engine=new PythonIrrigationEngine();

export async function pythonEngineDecision(payload){
  return engine.decide(payload);
}

export function stopPythonEngine(){engine.stop()}

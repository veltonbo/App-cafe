import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {sendReport} from './telegram-report.mjs';
const root=resolve('.'),report=resolve(process.env.F2E_QA_REPORT||'/tmp/fazenda2e-quality-agent.json');
const checks=[];const notes=[];const fast=process.env.F2E_QA_FAST==='1';const add=(name,ok,detail='',severity='error')=>checks.push({name,ok,detail,severity});
function run(name,cmd,args=[],{severity='error',timeout=180000}={}){try{const out=execFileSync(cmd,args,{cwd:root,encoding:'utf8',timeout,stdio:['ignore','pipe','pipe']});add(name,true,out.trim().slice(-1600),severity);return out}catch(e){add(name,false,String(e.stderr||e.stdout||e.message).slice(-2200),severity);return null}}
function imports(file){const s=readFileSync(file,'utf8');return[...s.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)].map(x=>x[1])}
function publicAppCheck(){const html=run('public-app','curl',['-fsSL','--max-time','12','https://fazenda2e.tail890201.ts.net/f2e/']);if(!html)return;add('public-no-legacy-splash',!html.includes('Carregando Fazenda 2E'),html.includes('Carregando Fazenda 2E')?'splash legado detectado':'ok');const m=html.match(/\/f2e\/assets\/[^"']+\.js/);if(!m){add('public-js-reference',false,'bundle JS não encontrado');return}run('public-js-asset','curl',['-fsS','--max-time','12','-o','/dev/null','https://fazenda2e.tail890201.ts.net'+m[0]]);}
if(!fast){
for(const f of ['server/continuous/autonomy-supervisor.js','server/continuous/seconds-manager.js'])if(existsSync(f))for(const imp of imports(f)){const p=resolve(dirname(resolve(f)),imp);add(`import:${f}:${imp}`,existsSync(p)||existsSync(p+'.js'),existsSync(p)||existsSync(p+'.js')?'ok':'MISSING')}
run('node-tests','npm',['test']);run('frontend-build','npm',['--prefix','irrigacao-react','run','build']);
run('supervisor-import','node',['-e',"import('./server/continuous/autonomy-supervisor.js').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"]);
run('forecast-import','node',['-e',"import('./server/api/weather/forecast.js').then(m=>{if(typeof m.loadForecast!=='function')throw Error('loadForecast ausente')}).catch(e=>{console.error(e);process.exit(1)})"]);
for(const f of ['server/continuous/server.js','server/continuous/seconds-manager.js','server/continuous/autonomy-supervisor.js','server/api/session.js','server/api/users.js'])run(`syntax:${f}`,'node',['--check',f]);
}else notes.push({key:'fast-cycle',detail:'Ciclo leve: validações profundas ficam para a rodada periódica.'});
if(process.env.F2E_QA_LIVE==='1'){
 run('docker-production','docker',['inspect','fazenda2e-irrigacao','--format','{{.State.Status}} restarts={{.RestartCount}} oom={{.State.OOMKilled}}']);
 run('health-local','curl',['-fsS','--max-time','5','http://127.0.0.1:8080/health']);
 run('health-public','curl',['-fsS','--max-time','12','https://fazenda2e.tail890201.ts.net/health']);
 publicAppCheck();
 const funnel=run('tailscale-funnel','tailscale',['funnel','status']);if(funnel)add('funnel-proxy-8080',/Funnel on[\s\S]*127\.0\.0\.1:8080/.test(funnel),'Funnel deve publicar 127.0.0.1:8080');
 run('auth-route-probe','curl',['-fsS','--max-time','8','https://fazenda2e.tail890201.ts.net/api/session?probe=1']);
 run('docker-resources','docker',['stats','--no-stream','fazenda2e-irrigacao','--format','{{.MemUsage}} {{.CPUPerc}}']);
 run('disk-root','sh',['-c',"u=$(df -P / | awk 'NR==2{gsub(/%/,\"\",$5);print $5}'); echo usage=${u}%; [ \"$u\" -lt 80 ]"]);
 run('recent-fatal-logs','sh',['-c',"! docker logs --since 20m fazenda2e-irrigacao 2>&1 | grep -Eiq 'ReferenceError|TypeError|fatal|uncaught|out of memory|ENOMEM'"]);
 run('weather-runtime','sh',['-c',"docker logs --since 20m fazenda2e-irrigacao 2>&1 | grep -E 'weatherError: null|Weather2-2|weather.*online' | tail -1 || true"],{severity:'warning'});
 run('viveiro-runtime-audit','sh',['-c',"! docker logs --since 90m fazenda2e-irrigacao 2>&1 | grep -Eiq 'cloud_latency_high|many_interruptions'"],{severity:'warning'});
 run('viveiro-history-audit','node',['-e',"const fs=require('fs'),p='/home/ubuntu/fazenda2e-data/irrigation-history.ndjson',cut=Date.now()-90*60e3,bad=new Set(['cloud_latency_high','many_interruptions','long_pulse_gap','confirmation_stale','weather_offline']);let active=new Set;for(const l of fs.readFileSync(p,'utf8').trim().split('\\n').slice(-800)){try{const x=JSON.parse(l),ts=Number(x.ts||0);if(ts<cut)continue;if(x.type==='viveiro_audit_alert'&&bad.has(x.audit_code))active.add(x.audit_code);if(x.type==='viveiro_audit_recovered')for(const c of x.cleared_codes||[])active.delete(c)}catch{}}if(active.size){console.error([...active].join(','));process.exit(1)}"],{severity:'warning'});
 const gs=run('git-state','git',['status','--short'],{severity:'info'});if(gs?.trim())notes.push({key:'git-dirty',detail:`${gs.trim().split(/\n/).length} alterações locais; preservadas, sem autofix.`});
}
const failed=checks.filter(x=>!x.ok&&x.severity==='error'),warnings=checks.filter(x=>!x.ok&&x.severity==='warning');
const result={agent:'Fazenda 2E Quality Guardian',version:5.2,mode:fast?'safe-live-watch':'safe-deep-validate',hardware_actions:false,checked_at:Date.now(),status:failed.length?'attention':warnings.length?'degraded':'healthy',passed:checks.filter(x=>x.ok).length,total:checks.length,failed:failed.length,warnings:warnings.length,notes,checks};
mkdirSync(dirname(report),{recursive:true});writeFileSync(report,JSON.stringify(result,null,2));
const summary=`Status: ${result.status}\nVerificações: ${result.passed}/${result.total} aprovadas\nFalhas: ${result.failed}\nAvisos: ${result.warnings}${failed.length?'\n• '+failed.map(x=>x.name).join('\n• '):'\nNenhuma falha crítica detectada.'}`;
if(process.env.F2E_QA_NOTIFY!=='0'){try{await sendReport({title:'🛡 Fazenda 2E • Quality Guardian 5.2',text:summary})}catch(e){console.error('telegram-report:',e.message)}}
console.log(JSON.stringify({status:result.status,version:result.version,passed:result.passed,total:result.total,failed:result.failed,warnings:result.warnings,failures:failed.map(x=>x.name)},null,2));process.exit(failed.length?2:0);

// Compatibilidade do contrato legado: version:2

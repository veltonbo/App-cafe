import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {sendReport} from './telegram-report.mjs';
const root=resolve('.'), report=resolve(process.env.F2E_QA_REPORT||'/tmp/fazenda2e-quality-agent.json');
const checks=[]; const add=(name,ok,detail='')=>checks.push({name,ok,detail});
function run(name,cmd,args=[]){try{const out=execFileSync(cmd,args,{cwd:root,encoding:'utf8',timeout:180000,stdio:['ignore','pipe','pipe']});add(name,true,out.trim().slice(-1200));return true}catch(e){add(name,false,String(e.stderr||e.stdout||e.message).slice(-1800));return false}}
function imports(file){const s=readFileSync(file,'utf8');return [...s.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)].map(x=>x[1])}
for(const f of ['server/continuous/autonomy-supervisor.js','server/continuous/seconds-manager.js'])if(existsSync(f))for(const imp of imports(f)){const p=resolve(dirname(resolve(f)),imp);add(`import:${f}:${imp}`,existsSync(p)||existsSync(p+'.js'),existsSync(p)||existsSync(p+'.js')?'ok':'MISSING')}
run('node-tests','npm',['test']);
run('frontend-build','npm',['--prefix','irrigacao-react','run','build']);
run('supervisor-import','node',['-e',"import('./server/continuous/autonomy-supervisor.js').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"]);
run('forecast-import','node',['-e',"import('./server/api/weather/forecast.js').then(m=>{if(typeof m.loadForecast!=='function')throw Error('loadForecast ausente')}).catch(e=>{console.error(e);process.exit(1)})"]);
for(const f of ['server/continuous/server.js','server/continuous/seconds-manager.js','server/continuous/autonomy-supervisor.js'])run(`syntax:${f}`,'node',['--check',f]);
if(process.env.F2E_QA_LIVE==='1'){
 run('docker-production','docker',['inspect','fazenda2e-irrigacao','--format','{{.State.Status}} restarts={{.RestartCount}} oom={{.State.OOMKilled}}']);
 run('health-local','curl',['-fsS','--max-time','5','http://127.0.0.1:8080/health']);
 run('health-public','curl',['-fsS','--max-time','10','https://fazenda2e.tail890201.ts.net/health']);
 run('docker-resources','docker',['stats','--no-stream','fazenda2e-irrigacao','--format','{{.MemUsage}} {{.CPUPerc}}']);
 run('disk-root','sh',['-c',"u=$(df -P / | awk 'NR==2{gsub(/%/,\"\",$5);print $5}'); echo usage=${u}%; [ \"$u\" -lt 70 ]"]);
 run('recent-fatal-logs','sh',['-c',"! docker logs --since 15m fazenda2e-irrigacao 2>&1 | grep -Eiq 'ReferenceError|TypeError|fatal|uncaught|out of memory'"]);
}
const failed=checks.filter(x=>!x.ok);const result={agent:'Fazenda 2E Quality Guardian',version:1,mode:'safe-autofix',checked_at:Date.now(),status:failed.length?'attention':'healthy',passed:checks.length-failed.length,failed:failed.length,checks};mkdirSync(dirname(report),{recursive:true});writeFileSync(report,JSON.stringify(result,null,2));
const summary=`Status: ${result.status}\nVerificações: ${result.passed}/${checks.length} aprovadas\nFalhas: ${result.failed}${failed.length?'\n• '+failed.map(x=>x.name).join('\n• '):'\nNenhuma anomalia detectada.'}`;
try{await sendReport({title:'🛡 Fazenda 2E • Quality Guardian',text:summary})}catch(e){console.error('telegram-report:',e.message)}
console.log(JSON.stringify({status:result.status,passed:result.passed,failed:result.failed,failures:failed.map(x=>x.name)},null,2));process.exit(failed.length?2:0);

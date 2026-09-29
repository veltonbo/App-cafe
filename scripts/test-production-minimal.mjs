import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const obsolete=new Set(['final-production.test.js','viveiro-ui.test.js','safety-ui.test.js','secure-session-ui-patch.test.js']);
const files=readdirSync('tests').filter(x=>x.endsWith('.test.js')&&!obsolete.has(x)).map(x=>'tests/'+x);
if(!files.length){console.error('Nenhum teste de produção encontrado.');process.exit(1)}
const r=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
process.exit(r.status??1);

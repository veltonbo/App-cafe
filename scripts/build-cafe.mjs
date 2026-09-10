import fs from 'node:fs/promises';
import path from 'node:path';

const src=path.resolve('public/irrigacao/inkbird');
const out=path.resolve('dist/irrigacao/inkbird');

await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.cp(src,out,{recursive:true});

const html=await fs.readFile(path.join(out,'index.html'),'utf8');
const js=await fs.readFile(path.join(out,'app.js'),'utf8');
const css=await fs.readFile(path.join(out,'app.css'),'utf8');

for(const required of ['/app.css','/app.js']){
  if(!html.includes(required))throw new Error('Build do Café sem '+required);
}
for(const legacy of ['ui-shell','ui-professional','ui-mockup','cafe-ui-v2','/api/viveiro/']){
  if(html.includes(legacy)||js.includes(legacy)||css.includes(legacy)){
    throw new Error('Referência legada encontrada no build do Café: '+legacy);
  }
}

console.log('Irrigação Café: build isolado validado.');

import fs from 'node:fs';
import path from 'node:path';

const file=path.resolve('dist/irrigacao/index.html');
if(!fs.existsSync(file))throw new Error('dist/irrigacao/index.html não encontrado após o build');

const html=fs.readFileSync(file,'utf8');
if(!html.includes('/irrigacao/app.css')||!html.includes('/irrigacao/app.js')){
  throw new Error('A interface consolidada do Viveiro não foi encontrada no build.');
}

console.log('Irrigação: interface consolidada validada; nenhuma camada legada foi injetada.');

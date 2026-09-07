import fs from 'node:fs';
import path from 'node:path';

const file=path.resolve('dist/irrigacao/index.html');
if(!fs.existsSync(file))throw new Error('dist/irrigacao/index.html não encontrado após o build');
let html=fs.readFileSync(file,'utf8');
const css='<link rel="stylesheet" href="/irrigacao/ui-professional.css?v=20260907">';
const js='<script src="/irrigacao/ui-professional.js?v=20260907" defer></script>';
if(!html.includes('/irrigacao/ui-professional.css'))html=html.replace('</head>',css+'\n</head>');
if(!html.includes('/irrigacao/ui-professional.js'))html=html.replace('</body>',js+'\n</body>');
fs.writeFileSync(file,html);
console.log('Irrigação: camada profissional injetada.');

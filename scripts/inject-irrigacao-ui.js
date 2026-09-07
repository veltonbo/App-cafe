import fs from 'node:fs';
import path from 'node:path';

const file=path.resolve('dist/irrigacao/index.html');
if(!fs.existsSync(file))throw new Error('dist/irrigacao/index.html não encontrado após o build');
let html=fs.readFileSync(file,'utf8');
html=html.split('\n').filter(line=>!line.includes('ui-professional.css')&&!line.includes('ui-professional.js')).join('\n');
const css='<link rel="stylesheet" href="/irrigacao/ui-professional.css?v=20260907-5">';
const js='<script src="/irrigacao/ui-professional.js?v=20260907-5" defer></script>';
html=html.replace('</head>',css+'\n</head>');
html=html.replace('</body>',js+'\n</body>');
fs.writeFileSync(file,html);
console.log('Irrigação: layout inteligente v5 injetado.');

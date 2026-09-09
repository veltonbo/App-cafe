import fs from 'node:fs';
import path from 'node:path';

const file=path.resolve('dist/irrigacao/index.html');
if(!fs.existsSync(file))throw new Error('dist/irrigacao/index.html não encontrado após o build');
let html=fs.readFileSync(file,'utf8');
html=html.split('\n').filter(line=>!line.includes('ui-professional.css')&&!line.includes('ui-professional.js')&&!line.includes('ui-shell.css')&&!line.includes('ui-shell.js')).join('\n');
const css='<link rel="stylesheet" href="/irrigacao/ui-professional.css?v=20260909-15">\n<link rel="stylesheet" href="/irrigacao/ui-shell.css?v=20260909-4">';
const js='<script src="/irrigacao/ui-professional.js?v=20260909-15" defer></script>\n<script src="/irrigacao/ui-shell.js?v=20260909-4" defer></script>';
html=html.replace('</head>',css+'\n</head>');
html=html.replace('</body>',js+'\n</body>');
fs.writeFileSync(file,html);
console.log('Irrigação: interface consolidada v11 injetada.');

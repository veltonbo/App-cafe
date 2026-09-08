import fs from 'node:fs';

const file=process.argv[2];
if(!file||!fs.existsSync(file)){
  console.log('AUDIT_SUMMARY unavailable');
  process.exit(0);
}
let data;
try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch{
  console.log('AUDIT_SUMMARY invalid');
  process.exit(0);
}
const vulns=data?.vulnerabilities||{};
const rows=Object.entries(vulns).map(([name,v])=>({
  name,
  severity:v?.severity||'unknown',
  direct:Boolean(v?.isDirect),
  range:v?.range||'',
  fixAvailable:v?.fixAvailable??null,
  via:(Array.isArray(v?.via)?v.via:[]).map(x=>
    typeof x==='string'?x:{
      source:x?.source||null,
      name:x?.name||null,
      severity:x?.severity||null,
      title:x?.title||null,
      range:x?.range||null
    }
  )
}));
console.log('AUDIT_SUMMARY '+JSON.stringify({
  counts:data?.metadata?.vulnerabilities||{},
  rows
}));

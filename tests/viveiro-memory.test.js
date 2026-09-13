import test from 'node:test';
import assert from 'node:assert/strict';

test('10.000 datas de histórico reutilizam os formatadores sem criar objetos Intl por registro',async()=>{
 const Original=Intl.DateTimeFormat;let constructions=0;
 Intl.DateTimeFormat=function(...args){constructions++;return new Original(...args)};
 try{
  const {accountingDayKey}=await import('../server/continuous/accounting.js?memory');
  const baseline=constructions;
  for(let i=0;i<10000;i++)assert.equal(accountingDayKey(Date.parse('2026-09-12T11:00:00Z')+i),'2026-09-12');
  assert.equal(constructions,baseline);
 }finally{Intl.DateTimeFormat=Original}
});

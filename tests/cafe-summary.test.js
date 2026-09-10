import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCafeHistory } from '../server/api/cafe/dashboard.js';

const ts=s=>Date.parse(s);

test('Resumo do Café não duplica a mesma sessão',()=>{
  const history=[
    {type:'start',session_id:'s1',sector:1,ts:ts('2026-09-09T14:00:00Z')},
    {type:'start',session_id:'s1',sector:1,ts:ts('2026-09-09T14:00:00Z')},
    {type:'complete',session_id:'s1',sector:1,duration_minutes:10,ts:ts('2026-09-09T14:10:00Z')},
    {type:'complete',session_id:'s1',sector:1,duration_minutes:10,ts:ts('2026-09-09T14:10:00Z')}
  ];
  const out=summarizeCafeHistory(history,ts('2026-09-09T15:00:00Z'));
  assert.equal(out.today.sessions,1);
  assert.equal(out.today.completed,1);
  assert.equal(out.today.sectors,1);
  assert.equal(out.today.completed_minutes,10);
});

test('Grupo conta uma irrigação e todos os setores envolvidos',()=>{
  const history=[
    {
      type:'group_start',session_id:'g1',controller_index:1,ts:ts('2026-09-09T15:00:00Z'),
      zones:[{zone:1,duration_minutes:5},{zone:3,duration_minutes:7},{zone:5,duration_minutes:8}]
    },
    {type:'complete',session_id:'g1',duration_minutes:20,ts:ts('2026-09-09T15:20:00Z')}
  ];
  const out=summarizeCafeHistory(history,ts('2026-09-09T16:00:00Z'));
  assert.equal(out.today.sessions,1);
  assert.equal(out.today.sectors,3);
  assert.equal(out.today.completed,1);
  assert.equal(out.today.completed_minutes,20);
});

test('Eventos do Viveiro não entram no resumo do Café quando ausentes do namespace',()=>{
  const history=[
    {type:'start',session_id:'s2',sector:2,ts:ts('2026-09-09T17:00:00Z')},
    {type:'complete',session_id:'s2',sector:2,duration_minutes:15,ts:ts('2026-09-09T17:15:00Z')}
  ];
  const out=summarizeCafeHistory(history,ts('2026-09-09T18:00:00Z'));
  assert.equal(out.today.sessions,1);
  assert.equal(out.today.completed_minutes,15);
});

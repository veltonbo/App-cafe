import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCafeReports } from '../server/cafe/reporting.js';

const ts=s=>Date.parse(s);
const controllers=[{id:'iic1',controller_index:1,sector_start:1,sector_end:8}];

test('relatório do Café resume sessões e setores sem duplicar',()=>{
  const history=[
    {type:'start',session_id:'s1',controller_id:'iic1',controller_index:1,sector:1,duration_minutes:10,ts:ts('2026-09-09T14:00:00Z')},
    {type:'start',session_id:'s1',controller_id:'iic1',controller_index:1,sector:1,duration_minutes:10,ts:ts('2026-09-09T14:00:00Z')},
    {type:'complete',session_id:'s1',controller_id:'iic1',sector:1,duration_minutes:10,ts:ts('2026-09-09T14:10:00Z')}
  ];
  const reports=buildCafeReports(history,{},controllers,null,ts('2026-09-09T16:00:00Z'));
  assert.equal(reports.today.sessions,1);
  assert.equal(reports.today.completed,1);
  assert.equal(reports.today.sectors,1);
  assert.equal(reports.sectors.find(x=>x.sector===1).starts_30d,1);
});

test('relatório do Café conta grupo por setores',()=>{
  const history=[
    {type:'group_start',session_id:'g1',controller_id:'iic1',controller_index:1,zones:[
      {zone:1,duration_minutes:5},{zone:3,duration_minutes:7}
    ],ts:ts('2026-09-09T14:00:00Z')}
  ];
  const reports=buildCafeReports(history,{},controllers,null,ts('2026-09-09T16:00:00Z'));
  assert.equal(reports.today.sessions,1);
  assert.equal(reports.today.sectors,2);
  assert.equal(reports.today.planned_minutes,12);
  assert.equal(reports.sectors.find(x=>x.sector===3).planned_minutes_30d,7);
});

test('relatório do Café expõe incidentes e 30 dias de tendência',()=>{
  const now=ts('2026-09-09T16:00:00Z');
  const incidents={
    x:{code:'controller_offline_iic1',level:'critical',status:'open',message:'IIC-800 offline',opened_at:now-60000}
  };
  const reports=buildCafeReports([],incidents,controllers,{status:'critical'},now);
  assert.equal(reports.status_today,'critical');
  assert.equal(reports.incidents.totals.open_critical,1);
  assert.equal(reports.trend30.length,30);
});

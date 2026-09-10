import test from 'node:test';
import assert from 'node:assert/strict';
import { buildViveiroReports } from '../server/continuous/reporting.js';

const ts=s=>Date.parse(s);

test('relatório do Viveiro resume pulsos e ajustes do dia',()=>{
  const history=[
    {type:'viveiro_pulse_start',pulse_id:'p1',source:'viveiro_fast',ts:ts('2026-09-09T14:00:00Z')},
    {type:'viveiro_pulse_complete',pulse_id:'p1',source:'viveiro_fast',actual_duration_seconds:30,ts:ts('2026-09-09T14:00:30Z')},
    {type:'viveiro_climate_auto_change',source:'viveiro_fast',temperature:34.2,humidity:55,vpd:2.1,to_off_seconds:80,ts:ts('2026-09-09T15:00:00Z')}
  ];
  const reports=buildViveiroReports(history,{}, {base_on_seconds:30,base_off_seconds:120,on_seconds:30,off_seconds:80}, null, ts('2026-09-09T16:00:00Z'));
  assert.equal(reports.today.pulses,1);
  assert.equal(reports.today.completed,1);
  assert.equal(reports.today.irrigated_seconds,30);
  assert.equal(reports.today.auto_adjustments,1);
  assert.equal(reports.today.climate.temperature_max,34.2);
});

test('relatório do Viveiro expõe incidentes e status crítico',()=>{
  const now=ts('2026-09-09T16:00:00Z');
  const incidents={
    a:{code:'weather_offline',level:'critical',status:'open',message:'Weather2-2 sem comunicação.',opened_at:now-60000}
  };
  const reports=buildViveiroReports([],incidents,{}, {status:'critical'},now);
  assert.equal(reports.status_today,'critical');
  assert.equal(reports.incidents.totals.open,1);
  assert.equal(reports.incidents.totals.open_critical,1);
});

test('relatório do Viveiro conta resolução automática e intervenção',()=>{
  const now=ts('2026-09-09T16:00:00Z');
  const incidents={
    a:{level:'warning',status:'resolved',resolution:'automatico',opened_at:now-500000,resolved_at:now-400000,duration_ms:100000},
    b:{level:'warning',status:'resolved',resolution:'intervencao',opened_at:now-300000,resolved_at:now-200000,duration_ms:100000}
  };
  const reports=buildViveiroReports([],incidents,{},null,now);
  assert.equal(reports.incidents.totals.resolved_automatic,1);
  assert.equal(reports.incidents.totals.resolved_intervention,1);
  assert.equal(reports.trend30.length,30);
});

test('relatório conta somente pulsos com desfecho confirmado',()=>{
  const now=ts('2026-09-09T16:00:00Z');
  const history=[
    {type:'viveiro_pulse_start',pulse_id:'orphan',source:'viveiro_fast',ts:ts('2026-09-09T14:00:00Z')},
    {type:'viveiro_pulse_start',pulse_id:'ok',source:'viveiro_fast',ts:ts('2026-09-09T14:10:00Z')},
    {type:'viveiro_pulse_complete',pulse_id:'ok',source:'viveiro_fast',actual_duration_seconds:30,ts:ts('2026-09-09T14:10:30Z')}
  ];
  const reports=buildViveiroReports(history,{}, {}, null, now);
  assert.equal(reports.today.start_attempts,2);
  assert.equal(reports.today.pulses,1);
  assert.equal(reports.today.orphaned_starts,1);
  assert.equal(reports.today.irrigated_seconds,30);
});

test('incidente resolvido hoje não mantém status ATENÇÃO ativo',()=>{
  const now=ts('2026-09-09T16:00:00Z');
  const incidents={
    old:{level:'warning',status:'resolved',opened_at:now-600000,resolved_at:now-300000,duration_ms:300000}
  };
  const reports=buildViveiroReports([],incidents,{}, {status:'ok'},now);
  assert.equal(reports.status_today,'normal');
});

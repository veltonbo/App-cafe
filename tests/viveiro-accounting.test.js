import test from 'node:test';
import assert from 'node:assert/strict';
import { pulseAccountingForDay } from '../server/continuous/accounting.js';

test('pulse_id deduplica retries de inicio e conclusao',()=>{
  const day='2026-09-09';
  const rows=[
    {id:'a',type:'viveiro_pulse_start',pulse_id:'p1',ts:Date.parse('2026-09-09T14:00:00Z')},
    {id:'b',type:'viveiro_pulse_start',pulse_id:'p1',ts:Date.parse('2026-09-09T14:00:00Z')},
    {id:'c',type:'viveiro_pulse_complete',pulse_id:'p1',ts:Date.parse('2026-09-09T14:00:30Z'),actual_duration_seconds:30.1},
    {id:'d',type:'viveiro_pulse_complete',pulse_id:'p1',ts:Date.parse('2026-09-09T14:00:30Z'),actual_duration_seconds:30.1}
  ];
  const a=pulseAccountingForDay(rows,day);
  assert.equal(a.pulses_started,1);
  assert.equal(a.pulses_completed,1);
  assert.equal(a.pulses_interrupted,0);
  assert.equal(a.irrigated_seconds,30.1);
});

test('um pulse_id possui apenas um desfecho contabil',()=>{
  const day='2026-09-09';
  const rows=[
    {id:'a',type:'viveiro_pulse_start',pulse_id:'p2',ts:Date.parse('2026-09-09T15:00:00Z')},
    {id:'b',type:'viveiro_pulse_interrupted',pulse_id:'p2',ts:Date.parse('2026-09-09T15:00:10Z'),actual_duration_seconds:10},
    {id:'c',type:'viveiro_pulse_complete',pulse_id:'p2',ts:Date.parse('2026-09-09T15:00:30Z'),actual_duration_seconds:30}
  ];
  const a=pulseAccountingForDay(rows,day);
  assert.equal(a.pulses_started,1);
  assert.equal(a.pulses_completed,1);
  assert.equal(a.pulses_interrupted,0);
  assert.equal(a.irrigated_seconds,30);
});

test('pulso que cruza meia-noite pertence ao dia em que iniciou',()=>{
  // Porto Velho = UTC-4. Comeca 23:59:50 local e termina 00:00:20 local.
  const rows=[
    {id:'a',type:'viveiro_pulse_start',pulse_id:'p3',ts:Date.parse('2026-09-10T03:59:50Z')},
    {id:'b',type:'viveiro_pulse_complete',pulse_id:'p3',ts:Date.parse('2026-09-10T04:00:20Z'),actual_duration_seconds:30}
  ];
  const before=pulseAccountingForDay(rows,'2026-09-09');
  const after=pulseAccountingForDay(rows,'2026-09-10');
  assert.equal(before.pulses_started,1);
  assert.equal(before.pulses_completed,1);
  assert.equal(before.irrigated_seconds,30);
  assert.equal(after.pulses_started,0);
  assert.equal(after.pulses_completed,0);
});

test('eventos legados sem pulse_id continuam contabilizados',()=>{
  const rows=[
    {id:'old-start',type:'viveiro_pulse_start',ts:Date.parse('2026-09-09T16:00:00Z')},
    {id:'old-end',type:'viveiro_pulse_complete',ts:Date.parse('2026-09-09T16:00:30Z'),duration_seconds:30}
  ];
  const a=pulseAccountingForDay(rows,'2026-09-09');
  assert.equal(a.pulses_started,1);
  assert.equal(a.pulses_completed,1);
  assert.equal(a.irrigated_seconds,30);
});

test('start órfão continua como pulso iniciado mas não como desfecho confirmado',()=>{
  const rows=[
    {id:'a',type:'viveiro_pulse_start',pulse_id:'p-orphan',ts:Date.parse('2026-09-09T15:00:00Z')},
    {id:'b',type:'viveiro_pulse_start',pulse_id:'p-ok',ts:Date.parse('2026-09-09T15:05:00Z')},
    {id:'c',type:'viveiro_pulse_complete',pulse_id:'p-ok',ts:Date.parse('2026-09-09T15:05:30Z'),actual_duration_seconds:30}
  ];
  const a=pulseAccountingForDay(rows,'2026-09-09');
  assert.equal(a.pulses_started,2);
  assert.equal(a.pulses_confirmed,1);
  assert.equal(a.orphaned_starts,1);
  assert.equal(a.irrigated_seconds,30);
});

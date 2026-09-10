import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSectorActivity, evaluateCafeAudit } from '../server/cafe/audit.js';

const controller={
  id:'iic-1',name:'IIC-800-WIFI',online:true,
  controller_index:1,sector_start:1,sector_end:8
};

test('auditoria do Café acusa controlador offline',()=>{
  const out=evaluateCafeAudit({
    controllers:[{...controller,online:false}],
    states:{},
    activeSessions:{},
    weather:{linked:true,checked_at:Date.parse('2026-09-09T16:00:00Z'),device:{online:true}},
    now:Date.parse('2026-09-09T16:01:00Z')
  });
  assert.equal(out.status,'critical');
  assert.ok(out.issues.some(x=>x.code==='controller_offline_iic-1'));
});

test('auditoria do Café acusa Weather2-2 desatualizada',()=>{
  const now=Date.parse('2026-09-09T16:30:00Z');
  const out=evaluateCafeAudit({
    controllers:[controller],
    states:{'iic-1':{runtime:{active_mask:0,pending_mask:0}}},
    activeSessions:{},
    weather:{linked:true,checked_at:now-16*60000,device:{online:true}},
    now
  });
  assert.equal(out.status,'warning');
  assert.ok(out.issues.some(x=>x.code==='weather_stale'));
});

test('auditoria do Café acusa irrigação além do término previsto',()=>{
  const now=Date.parse('2026-09-09T16:30:00Z');
  const out=evaluateCafeAudit({
    controllers:[controller],
    states:{'iic-1':{runtime:{active_mask:1,pending_mask:0}}},
    activeSessions:{'iic-1':{
      session_id:'s1',sector:1,started_at:now-30*60000,expected_end_at:now-6*60000
    }},
    weather:{linked:true,checked_at:now,device:{online:true}},
    now
  });
  assert.equal(out.status,'critical');
  assert.ok(out.issues.some(x=>x.code==='irrigation_overdue_iic-1'));
});

test('auditoria do Café detecta programação sem início registrado',()=>{
  const now=Date.parse('2026-09-09T16:00:00Z'); // 12:00 em Rondônia, quarta-feira
  const out=evaluateCafeAudit({
    controllers:[controller],
    states:{'iic-1':{runtime:{active_mask:0,pending_mask:0}}},
    activeSessions:{},
    weather:{linked:true,checked_at:now,device:{online:true}},
    history:[],
    schedules:{'iic-1':{
      1:{enabled:true,start_times:['10:00'],days_mask:8,cycle_mode:0,duration_minutes:10}
    }},
    now
  });
  assert.equal(out.status,'warning');
  assert.ok(out.issues.some(x=>x.code==='schedule_missed_iic-1_1'));
});

test('atividade por setor resume últimos sete dias',()=>{
  const now=Date.parse('2026-09-09T16:00:00Z');
  const history=[
    {type:'start',controller_id:'iic-1',controller_index:1,sector:1,duration_minutes:10,ts:now-3600000},
    {type:'group_start',controller_id:'iic-1',controller_index:1,zones:[
      {zone:1,duration_minutes:5},{zone:3,duration_minutes:7}
    ],ts:now-7200000}
  ];
  const activity=buildSectorActivity(history,[controller],now);
  assert.equal(activity['iic-1'][1].starts_7d,2);
  assert.equal(activity['iic-1'][1].planned_minutes_7d,15);
  assert.equal(activity['iic-1'][3].starts_7d,1);
  assert.equal(activity['iic-1'][3].planned_minutes_7d,7);
});

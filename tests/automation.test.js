import test from 'node:test';
import assert from 'node:assert/strict';

import { encodeCycle, decodeCycle } from '../server/api/_cycle.js';
import { localSchedule, secondsUntilNextWindow } from '../server/api/viveiro/_seconds.js';
import {
  climateConfidenceAdjustmentLimit,
  climateExtremeProfile,
  climateSuggestion,
  climateTrend,
  normalizeClimateConfig,
  updateClimateSamples,
  vaporPressureDeficit
} from '../server/api/viveiro/_climate.js';

test('cycle encode/decode round trip preserves requested values',()=>{
  const encoded=encodeCycle({
    enabled:true,
    daysMask:127,
    startMinutes:360,
    endMinutes:1080,
    onMinutes:1,
    offMinutes:2
  });
  const decoded=decodeCycle(encoded.raw);
  assert.ok(decoded);
  assert.equal(decoded.enabled,true);
  assert.equal(decoded.daysMask,127);
  assert.equal(decoded.startMinutes,360);
  assert.equal(decoded.endMinutes,1080);
  assert.equal(decoded.onMinutes,1);
  assert.equal(decoded.offMinutes,2);
});

test('cycle rejects end before start',()=>{
  assert.throws(()=>encodeCycle({
    enabled:true,
    daysMask:127,
    startMinutes:1080,
    endMinutes:360,
    onMinutes:1,
    offMinutes:2
  }),/horário final/i);
});

test('localSchedule honors Porto Velho time, weekday and window',()=>{
  // 2026-09-08 10:00 in Porto Velho (UTC-4) = 14:00Z. Tuesday = bit 2.
  const state={start_minutes:9*60,end_minutes:11*60,days_mask:1<<2};
  const inside=localSchedule(state,new Date('2026-09-08T14:00:00Z'));
  assert.equal(inside.day,2);
  assert.equal(inside.inside,true);

  const outside=localSchedule(state,new Date('2026-09-08T16:00:00Z'));
  assert.equal(outside.inside,false);
  assert.equal(outside.after_end,true);
});

test('secondsUntilNextWindow advances to next allowed day after window',()=>{
  // Daily schedule, local 11:30, next start at 09:00 tomorrow.
  const state={start_minutes:9*60,end_minutes:11*60,days_mask:127};
  const seconds=secondsUntilNextWindow(state,new Date('2026-09-08T15:30:00Z'));
  assert.equal(seconds,77400);
});

test('Automatico 2.0 defaults to observation, not automatic mutation',()=>{
  const cfg=normalizeClimateConfig({});
  assert.equal(cfg.automatic,false);
  assert.equal(cfg.observation,true);
  assert.equal(cfg.enabled,true);
});

test('climate suggestion preserves configured base pulse',()=>{
  const suggestion=climateSuggestion(
    {
      metrics:{
        temperature:{value:35},
        humidity:{value:35},
        rainDetected:false
      }
    },
    {
      base_on_seconds:30,
      base_off_seconds:90,
      on_seconds:30,
      off_seconds:90
    },
    {automatic:true,max_adjust_percent:30},
    {
      temperature:35,
      humidity:35,
      vpd:vaporPressureDeficit(35,35),
      vpd_delta:0.2,
      confidence:'high',
      confidence_label:'Alta'
    }
  );
  assert.equal(suggestion.target_on_seconds,30);
  assert.ok(suggestion.target_off_seconds<=90);
  assert.ok(suggestion.target_off_seconds>=30);
});

test('rain always prevents climate adjustment',()=>{
  const suggestion=climateSuggestion(
    {
      metrics:{
        temperature:{value:35},
        humidity:{value:35},
        rainDetected:true
      }
    },
    {
      base_on_seconds:30,
      base_off_seconds:90,
      on_seconds:30,
      off_seconds:90
    },
    {automatic:true},
    null
  );
  assert.equal(suggestion.useful,false);
  assert.equal(suggestion.level,'chuva');
  assert.equal(suggestion.target_on_seconds,30);
  assert.equal(suggestion.target_off_seconds,90);
});


test('Automatico 2.0 limita agressividade conforme a confianca',()=>{
  assert.equal(climateConfidenceAdjustmentLimit('low',30),10);
  assert.equal(climateConfidenceAdjustmentLimit('medium',30),15);
  assert.equal(climateConfidenceAdjustmentLimit('high',30),30);

  const makeSuggestion=(confidence)=>climateSuggestion(
    {
      metrics:{
        temperature:{value:36},
        humidity:{value:30},
        rainDetected:false
      }
    },
    {
      base_on_seconds:30,
      base_off_seconds:90,
      on_seconds:30,
      off_seconds:90
    },
    {automatic:true,max_adjust_percent:30},
    {
      temperature:36,
      humidity:30,
      vpd:vaporPressureDeficit(36,30),
      vpd_delta:0.30,
      confidence,
      confidence_label:confidence==='high'?'Alta':confidence==='medium'?'Média':'Baixa'
    }
  );

  const low=makeSuggestion('low');
  const medium=makeSuggestion('medium');
  const high=makeSuggestion('high');

  assert.equal(low.confidence_adjust_limit_percent,10);
  assert.equal(medium.confidence_adjust_limit_percent,15);
  assert.equal(high.confidence_adjust_limit_percent,30);
  assert.ok(low.target_off_seconds>medium.target_off_seconds);
  // Em calor extremo, confiança alta ganha teto maior, mas o primeiro passo é
  // limitado para evitar uma redução brusca do intervalo.
  assert.ok(high.effective_adjust_limit_percent>medium.effective_adjust_limit_percent);
  assert.equal(high.max_off_step_seconds,12);
  assert.ok(high.target_off_seconds>=78);
  assert.ok(high.target_off_seconds<low.target_off_seconds);
  assert.equal(low.target_on_seconds,30);
  assert.equal(medium.target_on_seconds,30);
  assert.equal(high.target_on_seconds,30);
});

test('Automatico 2.0 com baixa confianca sugere mudanca conservadora',()=>{
  const suggestion=climateSuggestion(
    {
      metrics:{
        temperature:{value:36},
        humidity:{value:30},
        rainDetected:false
      }
    },
    {
      base_on_seconds:30,
      base_off_seconds:90,
      on_seconds:30,
      off_seconds:90
    },
    {automatic:true,max_adjust_percent:30},
    {
      temperature:36,
      humidity:30,
      vpd:vaporPressureDeficit(36,30),
      vpd_delta:0.30,
      confidence:'low',
      confidence_label:'Baixa'
    }
  );
  assert.equal(suggestion.useful,true);
  assert.equal(suggestion.target_on_seconds,30);
  assert.ok(suggestion.target_off_seconds>=75);
});


test('Automatico 2.0 libera margem extra apenas em calor extremo com confianca alta',()=>{
  const severe=climateExtremeProfile({
    temperature:37.4,humidity:39,vpd:3.92,confidence:'high',baseLimitPercent:30
  });
  assert.equal(severe.level,'severo');
  assert.equal(severe.limit_percent,35);
  assert.equal(severe.factor_floor,1.35);

  const low=climateExtremeProfile({
    temperature:37.4,humidity:39,vpd:3.92,confidence:'low',baseLimitPercent:30
  });
  assert.equal(low.level,'normal');
  assert.equal(low.limit_percent,30);
});

test('Automatico 2.0 reduz mais o intervalo em cenario real de 37.4C e VPD 3.92',()=>{
  const suggestion=climateSuggestion(
    {
      metrics:{
        temperature:{value:37.4},
        humidity:{value:39},
        rainDetected:false
      }
    },
    {
      base_on_seconds:30,
      base_off_seconds:120,
      on_seconds:30,
      off_seconds:90
    },
    {
      automatic:true,
      max_adjust_percent:30,
      min_change_off_seconds:6
    },
    {
      temperature:37.4,
      humidity:39,
      vpd:3.92,
      vpd_delta:0.1,
      confidence:'high',
      confidence_label:'Alta'
    }
  );

  assert.equal(suggestion.extreme_level,'severo');
  assert.equal(suggestion.effective_adjust_limit_percent,35);
  assert.equal(suggestion.target_on_seconds,30);
  assert.ok(suggestion.target_off_seconds<=82);
  assert.ok(suggestion.target_off_seconds>=78);
  assert.equal(suggestion.useful,true);
});


test('Automatico 2.0 nao duplica a mesma observacao climatica',()=>{
  const snapshot={
    checked_at:1000000,
    metrics:{
      temperature:{value:33},
      humidity:{value:50}
    }
  };
  const cfg={trend_minutes:30};
  const first=updateClimateSamples([],snapshot,cfg,1000000);
  const second=updateClimateSamples(first,snapshot,cfg,1005000);
  assert.equal(first.length,1);
  assert.equal(second.length,1);
});

test('Automatico 2.0 rejeita salto climatico improvavel em poucos minutos',()=>{
  const base=[{
    ts:1000000,observation_ts:1000000,
    temperature:32,humidity:60,vpd:vaporPressureDeficit(32,60)
  }];
  const snapshot={
    checked_at:1120000,
    metrics:{
      temperature:{value:48},
      humidity:{value:15}
    }
  };
  const rows=updateClimateSamples(base,snapshot,{trend_minutes:30},1120000);
  assert.equal(rows.length,1);
  assert.equal(rows[0].temperature,32);
});

test('Automatico 2.0 usa regressao para detectar secagem progressiva',()=>{
  const rows=[
    {ts:0,temperature:30,humidity:65,vpd:vaporPressureDeficit(30,65)},
    {ts:300000,temperature:31,humidity:60,vpd:vaporPressureDeficit(31,60)},
    {ts:600000,temperature:32,humidity:55,vpd:vaporPressureDeficit(32,55)},
    {ts:900000,temperature:33,humidity:50,vpd:vaporPressureDeficit(33,50)},
    {ts:1200000,temperature:34,humidity:45,vpd:vaporPressureDeficit(34,45)}
  ];
  const trend=climateTrend(rows,1200000);
  assert.equal(trend.confidence,'high');
  assert.ok(trend.temp_slope_per_10m>0);
  assert.ok(trend.humidity_slope_per_10m<0);
  assert.ok(trend.vpd_slope_per_10m>0);
  assert.ok(trend.vpd_delta>0);
});

test('janela de irrigacao continua sendo a referencia do Automatico 2.0',()=>{
  const state={start_minutes:8*60,end_minutes:10*60,days_mask:1<<2};
  const before=localSchedule(state,new Date('2026-09-08T11:30:00Z')); // 07:30 local
  const inside=localSchedule(state,new Date('2026-09-08T12:30:00Z')); // 08:30 local
  const after=localSchedule(state,new Date('2026-09-08T15:00:00Z')); // 11:00 local
  assert.equal(before.inside,false);
  assert.equal(inside.inside,true);
  assert.equal(after.inside,false);
});

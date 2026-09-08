import test from 'node:test';
import assert from 'node:assert/strict';

import { encodeCycle, decodeCycle } from '../server/api/_cycle.js';
import { localSchedule, secondsUntilNextWindow } from '../server/api/viveiro/_seconds.js';
import {
  climateConfidenceAdjustmentLimit,
  climateSuggestion,
  normalizeClimateConfig,
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
  assert.ok(medium.target_off_seconds>high.target_off_seconds);
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

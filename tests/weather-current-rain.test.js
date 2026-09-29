import test from 'node:test';
import assert from 'node:assert/strict';
import {collectMetrics} from '../server/api/weather/_weather.js';

const spec={status:[
  {code:'rain_1h',values:{unit:'mm',scale:1}},
  {code:'rain_24h',values:{unit:'mm',scale:1}},
  {code:'rain_rate',values:{unit:'mm',scale:1}}
]};

test('rain_rate residual não mantém chuva ativa quando rain_1h zerou',()=>{
  const m=collectMetrics({rain_1h:0,rain_24h:66,rain_rate:6},{},spec);
  assert.equal(m.rainDetected,false);
  assert.equal(m.rain1h.value,0);
  assert.equal(m.rain24h.value,6.6);
});

test('rain_1h positivo continua bloqueando como chuva recente',()=>{
  const m=collectMetrics({rain_1h:4,rain_24h:66,rain_rate:0},{},spec);
  assert.equal(m.rainDetected,true);
  assert.equal(m.rain1h.value,0.4);
});
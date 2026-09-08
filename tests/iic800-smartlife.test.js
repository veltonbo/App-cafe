import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decodeDp45,
  decodeNormalTimer,
  encodeDp45Manual,
  encodeDp45Stop,
  encodeNormalTimerZone,
  dp45HasWatering
} from '../server/api/inkbird/_iic800.js';

test('IIC-800 DP45 manual duplica duracoes nos dois blocos',()=>{
  const raw=encodeDp45Manual({1:5,3:12},8);
  const data=Buffer.from(raw,'base64');
  assert.equal(data.length,34);
  assert.equal(data[0],1);
  assert.equal(data[1],1);
  assert.equal(data.readUInt16BE(2),5);
  assert.equal(data.readUInt16BE(6),12);
  assert.equal(data.readUInt16BE(18),5);
  assert.equal(data.readUInt16BE(22),12);

  const decoded=decodeDp45(raw);
  assert.equal(decoded.running_time[1],5);
  assert.equal(decoded.running_time[3],12);
  assert.equal(decoded.duration[1],5);
  assert.equal(decoded.duration[3],12);
  assert.equal(dp45HasWatering(raw,1),true);
  assert.equal(dp45HasWatering(raw,2),false);
});

test('IIC-800 DP45 stop usa byte inicial 1 e restante zero',()=>{
  const raw=encodeDp45Stop(8);
  const data=Buffer.from(raw,'base64');
  assert.equal(data.length,34);
  assert.equal(data[0],1);
  assert.ok([...data.subarray(1)].every(x=>x===0));
  assert.equal(dp45HasWatering(raw),false);
});

test('IIC-800 decodifica normal_timer real do Smart Life',()=>{
  const raw='0800FFFFFFFFFFFFFFFFFFFFFFFF007F1A090411';
  const decoded=decodeNormalTimer(raw);
  assert.equal(decoded.raw_length,20);
  assert.equal(decoded.channels.length,1);
  assert.equal(decoded.channels[0].zone,8);
  assert.equal(decoded.channels[0].enabled,false);
  assert.equal(decoded.channels[0].rain_sensor_follow,true);
});

test('IIC-800 DP38 escreve mascara da zona e blocos separados de hora/minuto',()=>{
  const encoded=encodeNormalTimerZone(null,3,{
    enabled:true,
    duration_minutes:10,
    start_times:['06:30','14:45'],
    cycle_mode:0,
    days_mask:0x7f,
    rain_sensor_follow:true
  });
  const data=Buffer.from(encoded.raw,'hex');
  assert.equal(data.length,20);
  assert.equal(data[0],0x04);
  assert.equal(data[1],10);
  assert.equal(data[2],6);
  assert.equal(data[3],14);
  assert.equal(data[8],30);
  assert.equal(data[9],45);
  assert.equal(data[14],0);
  assert.equal(data[15],0x7f);
  assert.equal(data[19],0x11);
});

test('IIC-800 DP38 desativado preserva formato seguro',()=>{
  const encoded=encodeNormalTimerZone(null,8,{
    enabled:false,
    duration_minutes:10,
    start_times:[],
    cycle_mode:0,
    days_mask:0x7f,
    rain_sensor_follow:true
  });
  const data=Buffer.from(encoded.raw,'hex');
  assert.equal(data[0],0x80);
  assert.equal(data[1],0);
  assert.ok([...data.subarray(2,14)].every(x=>x===0xff));
  assert.equal(data[15],0x7f);
  assert.equal(data[19],0x11);
});

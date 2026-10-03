import test from 'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const fw=fs.readFileSync('firmware/safe139/safe139.ino','utf8'),ctl=fs.readFileSync('server/api/esp32-controller.js','utf8'),sec=fs.readFileSync('server/api/viveiro/_seconds.js','utf8');
test('ESP32 1.4.0 reports local nursery pulse acknowledgement',()=>{assert.ok(fw.includes('FW_VERSION="1.4.0"'));assert.ok(fw.includes('lastNurseryPulseId=id'));assert.ok(fw.includes('nursery_pulse_id'));assert.ok(fw.includes('nursery_pulse_active'))});
test('manual local R1 command cancels local pulse deadline',()=>{assert.ok(fw.includes('if(n==1){nurseryPulseArmed=false;nurseryPulseDeadline=0;setRelay(0,on);}'))});
test('server persists nursery pulse acknowledgement',()=>{assert.ok(ctl.includes("s.nursery_pulse_id=String(b.nursery_pulse_id||'')"));assert.ok(ctl.includes('s.nursery_pulse_active=Boolean(b.nursery_pulse_active)'))});
test('nursery pulse accepts command ack even after short pulse ended',()=>{assert.ok(sec.includes("String(x.nursery_pulse_id||'')===id"));assert.ok(sec.includes("'esp32_command_ack'"))});

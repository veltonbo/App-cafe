import test from 'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const ui=fs.readFileSync('irrigacao-react/src/main.tsx','utf8');
test('interface minimalista mantém somente quatro áreas principais',()=>{for(const x of ["'home'","'nursery'","'coffee'","'climate'"])assert.ok(ui.includes(x));for(const x of ['Diagnóstico técnico','Firmware','Telemetria'])assert.equal(ui.includes(x),false)});
test('viveiro preserva configuração segura e chuva',()=>{assert.ok(ui.includes('configureSeconds'));assert.ok(ui.includes('weather_blocked'));assert.ok(ui.includes('resume_delay_minutes'))});
test('café preserva sequência protegida e controles',()=>{for(const x of ['esp32CoffeeSequenceStart','esp32CoffeeSequencePause','esp32CoffeeSequenceResume','esp32CoffeeSequenceStop','esp32CoffeeAutomationSave'])assert.ok(ui.includes(x));assert.ok(ui.includes('próxima válvula abre antes da atual fechar'))});
test('clima mantém chuva medida prioritária e previsão 6h',()=>{assert.ok(ui.includes('rain_detected'));assert.ok(ui.includes('hourly.slice(0,6)'));assert.ok(ui.includes('Chuva medida pela estação tem prioridade'))});
test('login e RBAC continuam ativos',()=>{assert.ok(ui.includes('restore()'));assert.ok(ui.includes("role==='master'"));assert.ok(ui.includes("levels?.includes('operate')"))});

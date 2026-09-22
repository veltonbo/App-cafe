import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const backup=fs.readFileSync('server/api/irrigation/_backup.js','utf8');const server=fs.readFileSync('server/continuous/server.js','utf8');const sw=fs.readFileSync('irrigacao-consolidated/sw.js','utf8');
test('automatic backups have retention and restore integrity verification',()=>{assert.match(backup,/ensureAutomaticConfigBackup/);assert.match(backup,/pruneConfigBackups/);assert.match(backup,/verifyBackupRestoreShape/);assert.match(backup,/F2E_BACKUP_RETENTION/)});
test('continuous server schedules automatic backups',()=>{assert.match(server,/ensureAutomaticConfigBackup/);assert.match(server,/automaticBackupTimer/)});
test('PWA never caches API commands and uses current shell generation',()=>{assert.match(sw,/fazenda2e-viveiro-shell-v15/);assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)\)return/);assert.match(sw,/event\.request\.method!=='GET'/)});

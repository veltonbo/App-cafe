import { auditViveiroHistoryReadOnly } from './history-audit.js';

try{
  await auditViveiroHistoryReadOnly();
}catch(error){
  console.error('VIVEIRO_HISTORY_AUDIT_ERROR',error?.stack||error?.message||String(error));
  process.exitCode=1;
}

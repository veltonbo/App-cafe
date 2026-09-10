import { appendHistory, storeSet } from '../api/irrigation/_store.js';

const repairs=[
  {
    day_key:'2026-09-06',
    pulses:0,
    raw_starts:0,
    completed:0,
    interrupted:0,
    unclosed_starts:0,
    irrigated_seconds:0,
    history_quality:'legacy_no_pulse_events',
    history_confidence:'medium',
    duration_basis:'no_confirmed_irrigation_events',
    note:'Há registros climáticos/de chuva no dia, mas nenhum pulso de irrigação confirmado no histórico disponível.'
  },
  {
    day_key:'2026-09-07',
    pulses:209,
    raw_starts:213,
    completed:209,
    interrupted:0,
    unclosed_starts:4,
    irrigated_seconds:6983,
    history_quality:'legacy_reconstructed',
    history_confidence:'medium',
    duration_basis:'recorded_duration_on_confirmed_final_events',
    note:'Reconstruído a partir de 209 fechamentos confirmados. Quatro starts líquidos ficaram sem fechamento; o legado também contém duas inversões de sequência, por isso não são contadas como irrigação concluída.'
  },
  {
    day_key:'2026-09-08',
    pulses:14,
    raw_starts:29,
    completed:14,
    interrupted:0,
    unclosed_starts:15,
    irrigated_seconds:420,
    history_quality:'legacy_reconstructed',
    history_confidence:'medium',
    duration_basis:'recorded_duration_on_confirmed_final_events',
    note:'Foram encontrados 29 starts, mas somente 14 fechamentos confirmados. Quinze starts extras/órfãos não são tratados como pulsos concluídos.'
  },
  {
    day_key:'2026-09-09',
    pulses:240,
    raw_starts:257,
    completed:239,
    interrupted:1,
    unclosed_starts:17,
    irrigated_seconds:7994.822,
    history_quality:'aggregate_recovered',
    history_confidence:'high',
    duration_basis:'preserved_reconciliation_snapshot',
    note:'O detalhe dos pulsos foi perdido no histórico atual, mas um snapshot de reconciliação preservou os totais antes do zeramento incorreto: 257 starts, 239 conclusões, 1 interrupção e 7.994,822 s irrigados.'
  }
];

for(const repair of repairs){
  const ts=Date.parse(repair.day_key+'T16:00:00.000Z');
  await appendHistory({
    event_id:'viveiro_daily_summary-'+repair.day_key,
    type:'viveiro_daily_summary',
    source:'viveiro_history_repair_20260910',
    status:'closed',
    detail:'Resumo diário consolidado após auditoria do histórico.',
    ts,
    at:new Date(ts).toISOString(),
    repaired_at:Date.now(),
    repair_version:1,
    ...repair
  });
}

await storeSet('IrrigacaoFazenda2E/historyRepairMeta/20260910',{
  status:'completed',
  completed_at:Date.now(),
  days:repairs.map(x=>x.day_key),
  method:'additive_canonical_daily_summary',
  raw_history_preserved:true
});

console.log('VIVEIRO_HISTORY_REPAIR_DONE',JSON.stringify(repairs.map(x=>({
  day:x.day_key,pulses:x.pulses,completed:x.completed,interrupted:x.interrupted,irrigated_seconds:x.irrigated_seconds,quality:x.history_quality
}))));

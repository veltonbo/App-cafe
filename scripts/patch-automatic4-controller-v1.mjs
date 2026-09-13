import fs from 'node:fs';

const file='server/continuous/seconds-manager.js';
let src=fs.readFileSync(file,'utf8');
const MARK='FAZENDA2E_AUTOMATIC4_CONTROLLER_V1';
if(src.includes(MARK))process.exit(0);

const importMarker="import { climateSuggestion, climateTrend, getClimateConfig, getClimateState, patchClimateState, updateClimateSamples, vaporPressureDeficit } from '../api/viveiro/_climate.js';";
if(!src.includes(importMarker))throw new Error('import climate marker not found');
src=src.replace(importMarker,importMarker+"\nimport { climate4Decision } from '../api/viveiro/_climate4.js';");

const functionMarker='async function persist(){';
if(!src.includes(functionMarker))throw new Error('persist marker not found');
const fn=`// ${MARK}\nasync function evaluateClimate4Controller(){\n  if(!state.enabled)return false;\n  const now=Date.now();\n  const nextReview=Number(state.climate4_next_review_at||0);\n  if(String(state.phase||'')==='climate4_wait'&&nextReview>now){\n    return false;\n  }\n  const [snapshot,climateState]=await Promise.all([\n    fetchWeatherSnapshot({maxAgeMs:5000}).catch(()=>null),\n    getClimateState().catch(()=>null)\n  ]);\n  if(!state.enabled)return false;\n  const decision=climate4Decision(snapshot||{},state,climateState||{},[],{now});\n  const previousDecision=String(state.climate4_last_decision||'');\n  const previousOff=Number(state.off_seconds||state.base_off_seconds||120);\n  const reviewSeconds=Math.max(60,Math.min(900,Number(decision.review_after_seconds||300)));\n  const shouldIrrigate=decision.should_irrigate!==false;\n  const targetOff=shouldIrrigate?Math.max(15,Math.min(900,Math.round(Number(decision.target_off_seconds||previousOff)))):previousOff;\n  state={\n    ...state,\n    automatic_version:4,\n    automatic_controller:'automatic4',\n    climate4_mode:'automatic',\n    climate4_controls_output:true,\n    climate4_last_decision:String(decision.decision||''),\n    climate4_last_reason:String(decision.reason||''),\n    climate4_last_evaluated_at:now,\n    climate4_next_review_at:now+reviewSeconds*1000,\n    climate4_should_irrigate:shouldIrrigate,\n    climate4_confidence_score:Number(decision.confidence_score||0),\n    climate4_rain:decision.rain||null,\n    climate4_vpd:decision?.reading?.vpd!=null&&Number.isFinite(Number(decision.reading.vpd))?Number(decision.reading.vpd):null,\n    climate4_temperature:decision?.reading?.temperature!=null&&Number.isFinite(Number(decision.reading.temperature))?Number(decision.reading.temperature):null,\n    climate4_humidity:decision?.reading?.humidity!=null&&Number.isFinite(Number(decision.reading.humidity))?Number(decision.reading.humidity):null,\n    off_seconds:targetOff\n  };\n  if(!shouldIrrigate){\n    if(state.device_relay===true||state.relay_expected===true)await safeOff('automatic4_wait');\n    state={...state,phase:'climate4_wait',relay_expected:false,expected_off_at:0,expected_next_on_at:0};\n    await persist();\n    if(previousDecision!==String(decision.decision||'')){\n      await event('viveiro_automatic4_wait','Automático 4.0 decidiu não irrigar agora.',{\n        decision:decision.decision,reason:decision.reason,review_after_seconds:reviewSeconds,\n        temperature:state.climate4_temperature,humidity:state.climate4_humidity,vpd:state.climate4_vpd,rain:decision.rain||null\n      });\n    }\n    return false;\n  }\n  if(String(state.phase||'')==='climate4_wait')state={...state,phase:'starting'};\n  await persist();\n  if(targetOff!==previousOff||previousDecision!==String(decision.decision||'')){\n    await event('viveiro_automatic4_decision','Automático 4.0 avaliou a necessidade de irrigação.',{\n      decision:decision.decision,reason:decision.reason,from_off_seconds:previousOff,to_off_seconds:targetOff,\n      temperature:state.climate4_temperature,humidity:state.climate4_humidity,vpd:state.climate4_vpd,rain:decision.rain||null\n    });\n  }\n  return true;\n}\n\n`;
src=src.replace(functionMarker,fn+functionMarker);

const oldCall='    await evaluateClimateControl();';
if(!src.includes(oldCall))throw new Error('old automatic call not found');
src=src.replace(oldCall,'    // Automático 2.0/3.0 desativados: somente o Automático 4.0 controla o clima.');

const pulseMarker="    if(!state.first_pulse_at&&!state.start_delay_alerted&&state.window_opened_at&&Date.now()>Number(state.window_opened_at)+30000){";
if(!src.includes(pulseMarker))throw new Error('pulse gate marker not found');
src=src.replace(pulseMarker,"    if(!(await evaluateClimate4Controller())){\n      const waitMs=Math.max(5000,Math.min(30000,Number(state.climate4_next_review_at||0)-Date.now()));\n      await sleep(waitMs);\n      continue;\n    }\n\n"+pulseMarker);

fs.writeFileSync(file,src);
console.log('[Fazenda 2E] Automático 4.0 exclusivo e adaptativo instalado.');

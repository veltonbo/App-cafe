import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function harness(){
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{textContent:'',dataset:{},hidden:false,className:'',classList:{toggle(){},add(){},remove(){}},addEventListener(){}});
    return elements.get(id);
  };
  let now=100000;
  const context=vm.createContext({
    document:{getElementById:element,querySelector:s=>element(s),querySelectorAll:()=>[],addEventListener(){}},
    location:{origin:'https://example.test',hostname:'example.test'},navigator:{onLine:true},
    localStorage:{getItem:()=>null,setItem(){}},window:{addEventListener(){}},
    URL,AbortController,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
    Date:class extends Date{static now(){return now}},fetch:async()=>{throw new Error('offline')}
  });
  const source=fs.readFileSync(process.env.VIVEIRO_UI_SOURCE||'public/irrigacao/app.js','utf8').replace('bootstrap();','globalThis.subject={app,renderOperation,renderMetrics,renderHealth,renderConnection,loadDashboard,dashboardConnected,fmtClock};');
  vm.runInContext(source,context);
  return {context,e:element,s:context.subject,advance:ms=>{now+=ms}};
}
function connected(h){h.s.app.sessionReady=true;h.s.app.dashboard={};h.s.app.lastDashboardAt=100000}

test('sem primeiro dashboard nunca declara conectado',()=>{const h=harness();assert.equal(h.s.dashboardConnected(),false);h.s.renderHealth();assert.equal(h.e('headerStateText').textContent,'Configurar')});
test('dados antigos deixam de ser considerados online após 30 segundos',()=>{const h=harness();connected(h);assert.equal(h.s.dashboardConnected(),true);h.advance(30001);h.s.renderConnection();h.s.renderHealth();assert.equal(h.e('offlineBar').hidden,false);assert.equal(h.e('headerStateText').textContent,'Reconectando')});
test('falha de atualização preserva os dados mas invalida a conexão',async()=>{const h=harness();connected(h);const before=h.s.app.dashboard;await h.s.loadDashboard();assert.equal(h.s.app.dashboard,before);assert.equal(h.s.dashboardConnected(),false);assert.equal(h.e('offlineBar').hidden,false)});
test('nova resposta válida recupera o estado da conexão',async()=>{const h=harness();connected(h);await h.s.loadDashboard();h.context.fetch=async()=>({ok:true,json:async()=>({seconds:{},weather:{metrics:{}}})});await h.s.loadDashboard(true);assert.equal(h.s.dashboardConnected(),true,h.e('toast').textContent);assert.equal(h.e('offlineBar').hidden,true)});
test('sem rede dados em cache não significam online',()=>{const h=harness();connected(h);h.context.navigator.onLine=false;assert.equal(h.s.dashboardConnected(),false)});
test('leituras nulas não são convertidas em zero',()=>{const h=harness();h.s.app.dashboard={current_weather:{metrics:{temperature:{value:null},humidity:{value:null},rain24h:{value:null}}},climate:{state:{vpd:null}}};h.s.renderMetrics();for(const id of ['temperature','humidity','rain','vpd'])assert.equal(h.e(id).textContent,'—',id);assert.equal(h.e('rainHint').textContent,'Aguardando leitura')});
test('leituras reais de zero são preservadas',()=>{const h=harness();h.s.app.dashboard={current_weather:{linked:true,metrics:{temperature:{value:0},humidity:{value:0},rain24h:{value:0},rainDetected:false}}};h.s.renderMetrics();assert.equal(h.e('temperature').textContent,'0.0 °C');assert.equal(h.e('humidity').textContent,'0%');assert.equal(h.e('rain').textContent,'0.0 mm')});
test('horários usam o fuso da fazenda',()=>{const h=harness();assert.equal(h.s.fmtClock(Date.parse('2026-09-12T11:00:00Z')),'07:00')});
test('sem dados o painel não afirma que todos os serviços respondem',()=>{const h=harness();connected(h);h.s.app.dashboard.intelligence={health:{level:'ok',message:'Normal'}};h.s.app.dashboardFailed=true;h.s.renderHealth();assert.equal(h.e('healthTitle').textContent,'Conexão não confirmada');assert.equal(h.e('healthIcon').textContent,'•')});

if(process.env.VIVEIRO_UI_SOURCE){
 for(const [phase,label] of Object.entries({starting_on:'LIGANDO',on:'IRRIGANDO',stopping_off:'DESLIGANDO',off:'INTERVALO',waiting_window:'AGUARDANDO HORÁRIO',weather_blocked:'PAUSADO POR CHUVA',waiting_after_rain:'AGUARDANDO APÓS CHUVA',weather_unavailable:'CLIMA INDISPONÍVEL',maintenance:'MANUTENÇÃO',emergency_stopped:'PARADA DE EMERGÊNCIA'})){
  test('interface publicada representa a fase '+phase,()=>{const h=harness();h.s.app.seconds={phase};h.s.renderOperation();assert.equal(h.e('operationLabel').textContent,label)});
 }
}

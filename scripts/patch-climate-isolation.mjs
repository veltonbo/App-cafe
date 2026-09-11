import fs from 'node:fs';

function replaceOnce(text,from,to,label){
  if(text.includes(to))return text;
  if(!text.includes(from))throw new Error('Não foi possível aplicar: '+label);
  return text.replace(from,to);
}

// 1) Weather2-2: cache compartilhado maior para que clima não sature Smart Life.
{
  const file='server/api/weather/_weather.js';
  let text=fs.readFileSync(file,'utf8');
  text=replaceOnce(text,
    "const WEATHER_CACHE_MS=4*1000;",
    "const WEATHER_CACHE_MS=15*1000;",
    'cache Weather2-2 15 s'
  );
  fs.writeFileSync(file,text);
}

// 2) Servidor contínuo: leitura visual da estação em 15 s; proteção completa em 30 s.
// A proteção real do modo em segundos continua no seconds-manager e não depende
// da previsão externa. Isto evita uma leitura completa do EKAZA a cada 4 segundos.
{
  const file='server/continuous/server.js';
  let text=fs.readFileSync(file,'utf8');
  text=replaceOnce(text,
    "let weatherWatchTimer=null;\nlet weatherWatchBusy=false;",
    "let weatherWatchTimer=null;\nlet weatherWatchBusy=false;\nlet lastProtectionCheckAt=0;",
    'estado do relógio climático'
  );
  text=replaceOnce(text,
    "const rawWeather=await fetchWeatherSnapshot({maxAgeMs:4000}).catch(error=>({",
    "const rawWeather=await fetchWeatherSnapshot({maxAgeMs:15000}).catch(error=>({",
    'cache do snapshot no watch'
  );
  const oldProtection=`        const result=await runViveiroWeatherCheck();\n        publishLive('protection',{\n          state:result?.state||{},\n          config:result?.config||cfg||{},\n          action:result?.action||'none',\n          at:Date.now()\n        });`;
  const newProtection=`        // A verificação completa também lê o EKAZA. Fazê-la a cada 4 s\n        // concorria com os comandos do ciclo. No modo em segundos, o seconds-manager\n        // continua sendo a autoridade de segurança em tempo real.\n        if(Date.now()-lastProtectionCheckAt>=30000){\n          lastProtectionCheckAt=Date.now();\n          const result=await runViveiroWeatherCheck();\n          publishLive('protection',{\n            state:result?.state||{},\n            config:result?.config||cfg||{},\n            action:result?.action||'none',\n            at:Date.now()\n          });\n        }`;
  text=replaceOnce(text,oldProtection,newProtection,'proteção climática desacoplada');
  text=replaceOnce(text,
    "  // A Weather2-2 é consolidada em tempo quase real. A antiga opção de\n  // \"checagem em minutos\" não controla mais este relógio: manter 4 s evita\n  // atraso na proteção e torna o comportamento da interface previsível.\n  const intervalMs=4000;",
    "  // Atualização da estação é independente do pulso. 15 s é suficiente para\n  // temperatura/umidade/chuva e preserva prioridade para comandos do EKAZA.\n  const intervalMs=15000;",
    'intervalo climático'
  );
  fs.writeFileSync(file,text);
}

// 3) Previsão externa: totalmente informativa, com cache longo e timeout curto.
{
  const file='server/api/weather/forecast.js';
  let text=fs.readFileSync(file,'utf8');
  text=replaceOnce(text,
    "const CACHE_MS=10*60*1000;",
    "const CACHE_MS=30*60*1000;",
    'cache da previsão'
  );
  text=replaceOnce(text,
    "const timer=setTimeout(()=>controller.abort(),8000);",
    "const timer=setTimeout(()=>controller.abort(),4000);",
    'timeout da previsão'
  );
  fs.writeFileSync(file,text);
}

// 4) Interface: previsão só depois da tela principal estabilizar e a cada 30 min.
{
  const file='scripts/inject-irrigacao-ui.js';
  let text=fs.readFileSync(file,'utf8');
  text=text.replaceAll('v=20260911-7','v=20260911-8');
  text=replaceOnce(text,
    "async function refreshClimateForecast(){if(!hasAuth()||!$('climateForecastPanel'))return;try{",
    "async function refreshClimateForecast(){if(!hasAuth()||!$('climateForecastPanel')||document.visibilityState!=='visible')return;try{",
    'previsão somente com app visível'
  );
  text=replaceOnce(text,
    "setTimeout(refreshClimateForecast,1800);setInterval(refreshClimateForecast,10*60000);setTimeout(refreshServerDiagnostics,1500);setInterval(refreshServerDiagnostics,30000);",
    "setTimeout(refreshClimateForecast,12000);setInterval(refreshClimateForecast,30*60000);setTimeout(refreshServerDiagnostics,1500);setInterval(refreshServerDiagnostics,30000);",
    'agenda da previsão'
  );
  fs.writeFileSync(file,text);
}

console.log('[Fazenda 2E] Clima isolado: Weather2-2 15 s, proteção 30 s, previsão 30 min.');

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <Update.h>

const char* FW_VERSION="1.3.4";
const int relePins[16]={32,23,33,22,4,21,26,19,27,18,14,5,15,17,13,16};
bool estadoRele[16]={false};
WebServer server(80);
Preferences prefs;
String apiUrl,deviceToken,pairCode,lastCommand="",wifiScanJson="";
unsigned long lastCloud=0;

void setRelay(int i,bool on){
  if(i<0||i>15)return;
  estadoRele[i]=on;
  digitalWrite(relePins[i],on?LOW:HIGH);
}
void allOff(){
  setRelay(1,false); setRelay(0,false);
  for(int i=2;i<16;i++)setRelay(i,false);
}
void coffeeSector(int relay,bool on){
  int i=relay-1; if(i<2||i>15)return;
  if(on){for(int j=2;j<16;j++)if(j!=i)setRelay(j,false);setRelay(i,true);delay(2000);setRelay(1,true);}
  else{setRelay(1,false);delay(2000);setRelay(i,false);}
}bool otaUpdate(String url){
  if(!url.startsWith("https://")||WiFi.status()!=WL_CONNECTED)return false;
  allOff();
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  if(!http.begin(client,url))return false;
  http.addHeader("x-device-token",deviceToken);
  int code=http.GET();
  if(code!=HTTP_CODE_OK){http.end();return false;}
  int len=http.getSize();
  if(len<=0||!Update.begin(len)){http.end();return false;}
  WiFiClient *stream=http.getStreamPtr();
  size_t done=Update.writeStream(*stream);
  bool ok=(done==(size_t)len)&&Update.end()&&Update.isFinished();
  http.end();
  if(ok){delay(500);ESP.restart();}
  return ok;
}

String pagina(){
  String h="<meta name=viewport content='width=device-width'><h2>Fazenda 2E</h2>";
  h+="<p>ESP32 16 canais - Firmware "+String(FW_VERSION)+"</p>";
  h+="<p>R1 Bomba Viveiro | R2 Bomba Cafe automatica | R3-R16 Setores Cafe</p>";
  for(int i=0;i<16;i++){
    h+="R"+String(i+1)+" - "+(estadoRele[i]?"LIGADO":"DESLIGADO");
    if(i!=1)h+=" <a href='/r?n="+String(i+1)+"&v=1'>LIGAR</a> <a href='/r?n="+String(i+1)+"&v=0'>DESLIGAR</a>";
    h+="<br>";
  }  h+="<p><a href='/off'>DESLIGAR TODOS</a></p><hr>";
  h+="<h3>Wi-Fi</h3><p><a href='/scan'><button type=button>Buscar redes proximas</button></a></p>";
  h+="<form method=POST action=/wifi><label>Rede Wi-Fi</label><br><input name=s id=ssid placeholder='Selecione ou digite a rede'><br>";
  h+="<input name=p type=password placeholder='Senha'><br><button>Salvar e conectar</button></form>";
  h+="<h3>Parear com Fazenda 2E</h3><form method=POST action=/pair>";
  h+="<input name=u placeholder='https://endereco-do-app'><br><input name=c placeholder='Codigo de pareamento'><br><button>Parear</button></form>";
  h+="<p>Cloud: "+String(deviceToken.length()?"PAREADO":"NAO PAREADO")+"</p>";
  return h;
}
void routes(){
  server.on("/",[](){server.send(200,"text/html",pagina());});
  server.on("/r",[](){int n=server.arg("n").toInt();bool on=server.arg("v")=="1";if(n==1)setRelay(0,on);else if(n>=3&&n<=16)coffeeSector(n,on);server.sendHeader("Location","/");server.send(302);});
  server.on("/off",[](){allOff();server.sendHeader("Location","/");server.send(302);});
  server.on("/scan",[](){
    int n=WiFi.scanNetworks(false,true);String h="<meta name=viewport content='width=device-width'><h2>Redes Wi-Fi proximas</h2><p>Toque na rede que deseja usar:</p>";
    if(n<=0)h+="<p>Nenhuma rede encontrada.</p>";
    else{for(int i=0;i<n;i++){String ss=WiFi.SSID(i);String esc=ss;esc.replace("&","&amp;");esc.replace("'","&#39;");esc.replace("<","&lt;");esc.replace(">","&gt;");String q=ss;q.replace("%","%25");q.replace(" ","%20");q.replace("&","%26");q.replace("?","%3F");q.replace("#","%23");h+="<p><a href='/select?s="+q+"'><button style='width:100%;padding:12px;text-align:left'>"+esc+" &nbsp; "+String(WiFi.RSSI(i))+" dBm "+String(WiFi.encryptionType(i)==WIFI_AUTH_OPEN?"(aberta)":"(com senha)")+"</button></a></p>";}}
    WiFi.scanDelete();h+="<p><a href='/'>Voltar</a></p>";server.send(200,"text/html",h);
  });
  server.on("/select",[](){String ss=server.arg("s");String esc=ss;esc.replace("&","&amp;");esc.replace("'","&#39;");esc.replace("<","&lt;");esc.replace(">","&gt;");String h="<meta name=viewport content='width=device-width'><h2>Conectar ao Wi-Fi</h2><form method=POST action=/wifi><label>Rede</label><br><input name=s value='"+esc+"' readonly><br><label>Senha</label><br><input name=p type=password autofocus><br><button style='margin-top:12px;padding:12px'>Conectar</button></form><p><a href='/scan'>Escolher outra rede</a></p>";server.send(200,"text/html",h);});
  server.on("/wifi",HTTP_POST,[](){String ss=server.arg("s"),pw=server.arg("p");if(ss.length()<1||ss.length()>32||(!(pw.length()==0||(pw.length()>=8&&pw.length()<=63)))){server.send(400,"text/html","Dados de Wi-Fi invalidos.<br><a href='/scan'>Voltar</a>");return;}allOff();prefs.putString("ssid",ss);prefs.putString("pass",pw);server.send(200,"text/html","Wi-Fi salvo. Reiniciando e conectando...<br>O ponto Fazenda2E-Teste continua disponivel para recuperacao.");delay(800);ESP.restart();});
  server.on("/pair",HTTP_POST,[](){apiUrl=server.arg("u");pairCode=server.arg("c");prefs.putString("url",apiUrl);prefs.putString("pair",pairCode);server.send(200,"text/html","Dados salvos. Pareamento automatico.<br><a href='/'>Voltar</a>");});
}
void tryPair(){
  if(deviceToken.length()||apiUrl.length()<8||pairCode.length()<8||WiFi.status()!=WL_CONNECTED)return;
  WiFiClientSecure client;client.setInsecure();HTTPClient http;
  http.begin(client,apiUrl+"/api/esp32/controller");http.addHeader("Content-Type","application/json");http.addHeader("x-pair-code",pairCode);
  int c=http.POST("{}");
  if(c==200){String x=http.getString();int a=x.indexOf("\"device_token\":\"");if(a>=0){a+=16;int b=x.indexOf('"',a);deviceToken=x.substring(a,b);prefs.putString("token",deviceToken);prefs.remove("pair");pairCode="";}}
  http.end();
}void cloud(){
  if(!deviceToken.length()||WiFi.status()!=WL_CONNECTED)return;
  WiFiClientSecure client;client.setInsecure();HTTPClient http;
  http.begin(client,apiUrl+"/api/esp32/controller");http.addHeader("Content-Type","application/json");http.addHeader("x-device-token",deviceToken);
  String rs="[";for(int i=0;i<16;i++){if(i)rs+=",";rs+=estadoRele[i]?"true":"false";}rs+="]";
  String body="{\"device_id\":\"fazenda2e-esp32-01\",\"firmware\":\""+String(FW_VERSION)+"\",\"rssi\":"+String(WiFi.RSSI())+",\"relays\":"+rs+"}";
  if(http.POST(body)==200){
    String x=http.getString();int idp=x.indexOf("\"id\":\"");String id="";
    if(idp>=0){idp+=6;int e=x.indexOf('"',idp);id=x.substring(idp,e);}
    if(id.length()&&id!=lastCommand){
      if(x.indexOf("\"type\":\"wifi_scan\"")>=0){
        int n=WiFi.scanNetworks(false,true);String a="[";for(int k=0;k<n&&k<30;k++){if(k)a+=",";String ss=WiFi.SSID(k);ss.replace("\\","\\\\");ss.replace("\"","\\\"");a+="{\"ssid\":\""+ss+"\",\"rssi\":"+String(WiFi.RSSI(k))+",\"secure\":"+String(WiFi.encryptionType(k)==WIFI_AUTH_OPEN?"false":"true")+"}";}a+="]";wifiScanJson=a;WiFi.scanDelete();}
      else if(x.indexOf("\"type\":\"all_off\"")>=0)allOff();
      else if(x.indexOf("\"type\":\"coffee_sector\"")>=0){int q=x.indexOf("\"relay\":");int n=x.substring(q+8).toInt();bool on=x.indexOf("\"on\":true",q)>=0;coffeeSector(n,on);}
      else if(x.indexOf("\"type\":\"relay\"")>=0){int q=x.indexOf("\"relay\":");int n=x.substring(q+8).toInt();bool on=x.indexOf("\"on\":true",q)>=0;if(n==1)setRelay(0,on);}
      else if(x.indexOf("\"type\":\"wifi\"")>=0){
        auto hexText=[](String h){String o="";for(unsigned int i=0;i+1<h.length();i+=2){char b[3]={h[i],h[i+1],0};o+=(char)strtol(b,nullptr,16);}return o;};
        int qs=x.indexOf("\"ssid_hex\":\"");int qp=x.indexOf("\"pass_hex\":\"");
        if(qs>=0&&qp>=0){qs+=12;qp+=12;int es=x.indexOf('"',qs),ep=x.indexOf('"',qp);String ns=hexText(x.substring(qs,es)),np=hexText(x.substring(qp,ep));if(ns.length()){lastCommand=id;allOff();prefs.putString("ssid",ns);prefs.putString("pass",np);http.end();delay(500);ESP.restart();return;}}
      }
      else if(x.indexOf("\"type\":\"firmware\"")>=0){int q=x.indexOf("\"url\":\"");if(q>=0){q+=7;int e=x.indexOf('"',q);String u=x.substring(q,e);lastCommand=id;http.end();otaUpdate(u);return;}}
      lastCommand=id;
    }
  }
  http.end();
}
void setup(){
  for(int i=0;i<16;i++){pinMode(relePins[i],OUTPUT);digitalWrite(relePins[i],HIGH);}
  prefs.begin("fazenda2e",false);apiUrl=prefs.getString("url","");deviceToken=prefs.getString("token","");pairCode=prefs.getString("pair","");
  WiFi.mode(WIFI_AP_STA);WiFi.softAP("Fazenda2E-Teste","12345678");
  String s=prefs.getString("ssid",""),p=prefs.getString("pass","");if(s.length())WiFi.begin(s.c_str(),p.c_str());
  routes();server.begin();
}
void loop(){server.handleClient();if(millis()-lastCloud>3000){lastCloud=millis();tryPair();cloud();}}

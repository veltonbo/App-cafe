#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
const int relePins[16]={32,23,33,22,4,21,26,19,27,18,14,5,15,17,13,16};
bool relays[16]={0}; WebServer web(80); Preferences prefs;
const char* AP_SSID="Fazenda2E-Teste"; const char* AP_PASS="12345678";
String serverUrl,deviceToken; unsigned long lastSync=0;
void setRelay(int i,bool on){if(i<0||i>15)return;relays[i]=on;digitalWrite(relePins[i],on?LOW:HIGH);}
void allOff(){for(int i=0;i<16;i++)setRelay(i,false);}
String page(){String h="<meta name=viewport content='width=device-width'><h2>Fazenda 2E - ESP32</h2><p>Configure o Wi-Fi da fazenda:</p><form method=POST action=/wifi><input name=s placeholder='Nome do Wi-Fi'><input name=p type=password placeholder='Senha'><button>Salvar</button></form><hr>";for(int i=0;i<16;i++){h+="R"+String(i+1)+" <a href='/r?n="+String(i+1)+"&v=1'>LIGAR</a> <a href='/r?n="+String(i+1)+"&v=0'>DESLIGAR</a><br>";}h+="<p><a href=/off>DESLIGAR TODOS</a></p>";return h;}
void localRoutes(){web.on("/",[](){web.send(200,"text/html",page());});web.on("/r",[](){int n=web.arg("n").toInt();setRelay(n-1,web.arg("v")=="1");web.sendHeader("Location","/");web.send(302);});web.on("/off",[](){allOff();web.sendHeader("Location","/");web.send(302);});web.on("/wifi",HTTP_POST,[](){prefs.putString("ssid",web.arg("s"));prefs.putString("pass",web.arg("p"));web.send(200,"text/html","<h3>Salvo. Reiniciando...</h3>");delay(800);ESP.restart();});}
void syncCloud(){if(WiFi.status()!=WL_CONNECTED||serverUrl.length()<8||deviceToken.length()<8)return;HTTPClient http;http.begin(serverUrl+"/api/esp32/controller");http.addHeader("Content-Type","application/json");http.addHeader("x-device-token",deviceToken);String a="[";for(int i=0;i<16;i++){if(i)a+=",";a+=relays[i]?"true":"false";}a+="]";String body="{\"device_id\":\"fazenda2e-esp32-01\",\"firmware\":\"1.0.0\",\"rssi\":"+String(WiFi.RSSI())+",\"relays\":"+a+"}";int c=http.POST(body);if(c==200){String x=http.getString();int p=x.indexOf("\"type\":\"all_off\"");if(p>=0)allOff();p=x.indexOf("\"type\":\"relay\"");if(p>=0){int q=x.indexOf("\"relay\":",p);int n=x.substring(q+8).toInt();int o=x.indexOf("\"on\":true",q);setRelay(n-1,o>=0);}}http.end();}
void setup(){for(int i=0;i<16;i++){pinMode(relePins[i],OUTPUT);digitalWrite(relePins[i],HIGH);}prefs.begin("f2e",false);serverUrl=prefs.getString("url","https://fazenda-2e-irrigacao-production.up.railway.app");deviceToken=prefs.getString("token","5b383248fef7ee57b155613d536fa5aaac9968443f15771b875c729e38e69428");WiFi.mode(WIFI_AP_STA);WiFi.softAP(AP_SSID,AP_PASS);String s=prefs.getString("ssid",""),p=prefs.getString("pass","");if(s.length()){WiFi.begin(s.c_str(),p.c_str());}localRoutes();web.begin();}
void loop(){web.handleClient();if(millis()-lastSync>3000){lastSync=millis();syncCloud();}}

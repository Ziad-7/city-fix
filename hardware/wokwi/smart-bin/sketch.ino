#include <Arduino.h>
#include <ArduinoJson.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "core.h"
#if defined(__has_include)
#if __has_include("root_ca.h")
#include "root_ca.h"
#endif
#endif

using namespace citycycle;
constexpr int TRIG=5, ECHO=18, ONEWIRE=4, BATTERY=34, NET_SW=27, SOLAR_SW=26;
constexpr int SAMPLE_BTN=25, LED_FULL=13, LED_HEAT=14, LED_STATUS=19, LED_CHARGE=23;
constexpr uint16_t MAGIC=0xCC31, VERSION=1;
OneWire oneWire(ONEWIRE); DallasTemperature ds(&oneWire); Preferences prefs;
Adafruit_SSD1306 display(128,64,&Wire,-1);

struct Persisted {
  uint16_t magic= MAGIC, version=VERSION;
  Queue queue{};
  ThresholdEdges edges{};
  float intervalMin=30;
  float fullPct=80;
  float heatC=60;
  uint32_t mockLastAccepted=0;
  uint32_t crc=0;
};
Persisted saved;
bool netOn=true, solarOn=false, netOverride=false, solarOverride=false;
bool fastMode=true, httpMode=false, tlsInsecure=false, lowPower=false, lastTempValid=false, lastDistanceValid=false;
bool failNext=false, partialNext=false, badAckNext=false;
Policy mockPolicy{};
bool storageUsable=false, samplePending=false; float lastTemp=NAN, lastDistance=NAN, lastBattery=3.9f; int fill=20;
Reading pendingReading{}; TemperatureConversion tempConversion; RetrySchedule retry; DeliveryGate deliveryGate;
uint32_t nextSample=0; bool previousNet=true;
char endpoint[192]="", deviceKey[160]="", materialId[]="pet_plastic";
char lastResult[72]="none";
String line;
void deliver(bool explicitRequest=false);

uint32_t savedCrc(const Persisted &p) { return crc32(&p, sizeof(Persisted)-sizeof(p.crc)); }
bool saveState() {
  saved.crc=savedCrc(saved); size_t n=prefs.putBytes("state",&saved,sizeof(saved));
  if(n!=sizeof(saved)){ Serial.println(F("NVS ERROR: state not saved; sample/ACK rolled back")); return false; }
  return true;
}
void loadState() {
  bool began=prefs.begin("citybin",false); bool exists=began&&prefs.isKey("state");
  Persisted candidate{}; size_t actual=exists?prefs.getBytesLength("state"):0;
  size_t read=exists&&actual==sizeof(candidate)?prefs.getBytes("state",&candidate,sizeof(candidate)):0;
  bool valid=candidate.magic==MAGIC&&candidate.version==VERSION&&candidate.crc==savedCrc(candidate)&&candidate.queue.count<=QueueCapacity&&candidate.queue.nextSeq>0&&std::isfinite(candidate.intervalMin)&&candidate.intervalMin>0&&candidate.intervalMin<=1440&&std::isfinite(candidate.fullPct)&&candidate.fullPct>=0&&candidate.fullPct<=100&&std::isfinite(candidate.heatC)&&candidate.heatC>=-40&&candidate.heatC<=125;
  LoadDisposition disposition=classifyPersistentLoad(began,exists,actual,sizeof(candidate),read,valid);
  if(disposition==LoadDisposition::RestoreExisting){saved=candidate;storageUsable=true;return;}
  if(disposition==LoadDisposition::InitializeMissing){saved=Persisted{};storageUsable=saveState();if(!storageUsable)Serial.println(F("NVS ERROR: initial state could not be saved; sampling/delivery disabled"));return;}
  storageUsable=false; Serial.println(F("NVS ERROR: existing state unreadable/invalid or storage unavailable; preserving record and disabling sample/delivery"));
}
void label(const __FlashStringHelper *s){ Serial.println(s); }
float readBattery() { return 3.0f + (analogRead(BATTERY)/4095.0f)*1.2f; }
float readDistance() {
  float samples[5];
  for(int i=0;i<5;i++){
    digitalWrite(TRIG,LOW); delayMicroseconds(3); digitalWrite(TRIG,HIGH); delayMicroseconds(10); digitalWrite(TRIG,LOW);
    unsigned long us=pulseIn(ECHO,HIGH,30000UL);
    if(us==0) return NAN; samples[i]=us*0.0343f/2.0f; delay(10);
  }
  for(int i=0;i<5;i++) for(int j=i+1;j<5;j++) if(samples[j]<samples[i]){float t=samples[i];samples[i]=samples[j];samples[j]=t;}
  if(!validDistanceCm(samples[2])) return NAN;
  return samples[2];
}
bool readTemperature(float &temp) {
  temp=ds.getTempCByIndex(0);
  return std::isfinite(temp) && temp!=DEVICE_DISCONNECTED_C && temp>=-40 && temp<=125;
}
String readingJson(const Reading &r) {
  JsonDocument doc; doc["seq"]=r.seq; doc["at"]=nullptr; doc["fillPct"]=r.fill;
  if(r.flags&2) doc["distanceCm"]=r.distance;
  if(r.flags&1) doc["tempC"]=r.temp;
  doc["batteryV"]=r.battery; doc["rssi"]=r.rssi; doc["fw"]="sim-0.1.0";
  String out; serializeJson(doc,out); return out;
}
uint32_t sampleIntervalMs() {
  uint32_t base=policyIntervalMs(saved.intervalMin,fastMode);
  return base*(lastBattery<3.4f?2UL:1UL);
}
void printQueue() {
  Serial.print(F("OUTBOX ["));
  for(uint8_t i=0;i<saved.queue.count;i++){if(i)Serial.print(',');Serial.print(readingJson(saved.queue.rows[i]));}
  Serial.println(']');
}
void render(const char *state) {
  digitalWrite(LED_FULL,saved.edges.full); digitalWrite(LED_HEAT,saved.edges.heat);
  digitalWrite(LED_STATUS, netOn && !lowPower); digitalWrite(LED_CHARGE,solarOn && lastBattery<4.15f);
  display.clearDisplay(); display.setTextColor(SSD1306_WHITE); display.setTextSize(1); display.setCursor(0,0);
  display.println(F("CITYCYCLE SIMULATOR")); display.print(F("Fill ")); display.print(lastDistanceValid?String(fill)+"%":"FAULT"); display.print(F(" T ")); display.println(lastTempValid?String(lastTemp,1)+"C":"--");
  display.print(F("Bat ")); display.print(lastBattery,2); display.print(F("V ")); display.println(lowPower?F("LOW POWER"):F("POWER OK"));
  display.print(F("Full ")); display.print(saved.edges.full?F("YES"):F("no")); display.print(F(" Heat ")); display.println(saved.edges.heat?F("YES"):F("no"));
  display.print(F("Net ")); display.print(netOn?F("ON"):F("OFF")); display.print(F(" Sol ")); display.print(solarOn?F("ON"):F("OFF")); display.print(F(" Chg ")); display.println(solarOn&&lastBattery<4.15f?F("YES"):F("no"));
  display.print(httpMode?F("HTTP"):F("LOCAL MOCK")); display.print(F(" Q:")); display.println(saved.queue.count); display.println(state); display.println(lastResult); display.display();
  uint32_t target=retry.waiting?retry.deadline:nextSample;uint32_t remaining=static_cast<int32_t>(target-millis())>0?(target-millis())/1000:0;
  Serial.print(F("SIMULATOR | state=")); Serial.print(state); Serial.print(F(" fill=")); Serial.print(lastDistanceValid?String(fill)+"%":"FAULT"); Serial.print(F(" distance=")); Serial.print(lastDistanceValid?String(lastDistance,1):"--"); Serial.print(F("cm temp=")); Serial.print(lastTempValid?String(lastTemp,1):"--"); Serial.print(F("C battery=")); Serial.print(lastBattery,2); Serial.print(F("V full=")); Serial.print(saved.edges.full); Serial.print(F(" heat=")); Serial.print(saved.edges.heat); Serial.print(F(" network=")); Serial.print(netOn?"ON":"OFF"); Serial.print(netOverride?F("(override)"):F("(switch)")); Serial.print(F(" solar=")); Serial.print(solarOn?"ON":"OFF"); Serial.print(solarOverride?F("(override)"):F("(switch)")); Serial.print(F(" charge=")); Serial.print(solarOn&&lastBattery<4.15f?"YES":"no"); Serial.print(F(" queue=")); Serial.print(saved.queue.count); Serial.print(F(" mode=")); Serial.print(httpMode?"HTTP":"LOCAL MOCK"); if(httpMode)Serial.print(tlsInsecure?F(" TLS UNVERIFIED DEMO"):F(" TLS CA VERIFIED/REQUIRED")); Serial.print(fastMode?F(" fast(30m=30s)"):F(" real-time")); Serial.print(F(" RSSI(sim)=")); Serial.print(netOn?-55:-127); Serial.print(F(" last=")); Serial.print(lastResult); Serial.print(F(" next=")); Serial.print(remaining); Serial.println(F("s"));
}
void commitSample(Reading r) {
  if(!storageUsable){label(F("NVS unavailable: sample not queued"));return;}
  bool edge=false;Persisted before=saved;
  AppendResult result=appendSampleTransaction(saved.queue,saved.edges,r,lastTempValid?lastTemp:NAN,saved.fullPct,saved.heatC,[](){return saveState();},edge);
  if(result==AppendResult::Full){label(F("QUEUE FULL: sample rejected; sequence/thresholds unchanged"));render("QUEUE FULL");return;}
  if(result==AppendResult::StorageFailed){saved=before;render("NVS ERROR: sample rolled back");return;}
  printQueue(); render("QUEUED");
  if(edge){label(F("THRESHOLD EDGE: immediate send requested"));deliver();}
}
void sampleNow() {
  if(!storageUsable){label(F("NVS unavailable: sample/delivery disabled"));render("NVS ERROR");return;}
  if(samplePending){label(F("TEMPERATURE CONVERSION pending; sample skipped"));return;}
  lastBattery=readBattery(); lowPower=lastBattery<3.1f;
  lastDistance=readDistance(); lastDistanceValid=std::isfinite(lastDistance); fill=fillPercent(lastDistance);
  lastTempValid=false;
  if(!lastDistanceValid){label(F("SENSOR FAULT: distance unavailable; no reading fabricated"));render("SENSOR FAULT");return;}
  pendingReading=Reading{}; pendingReading.fill=fill;pendingReading.distance=lastDistance;pendingReading.battery=lastBattery;pendingReading.rssi=netOn?-55:-127;pendingReading.flags=2;
  ds.requestTemperatures(); tempConversion.request(millis(),750); samplePending=true;
  label(F("SAMPLE: waiting for fresh DS18B20 conversion (750ms maximum)"));render("TEMP CONVERTING");
}
void finishPendingSample() {
  if(!samplePending)return;
  float temp=NAN;TemperatureResult tempResult=completeTemperature(tempConversion,millis(),[](float &value){return readTemperature(value);},temp);
  if(tempResult==TemperatureResult::Pending)return;
  lastTempValid=tempResult==TemperatureResult::Valid;samplePending=false;
  if(lastTempValid){lastTemp=temp;pendingReading.flags|=1;pendingReading.temp=temp;}
  else label(F("DS18B20 unavailable/invalid after conversion; temperature omitted"));
  commitSample(pendingReading);
}
bool validAccepted(JsonVariantConst accepted,uint32_t *sent,uint8_t sentCount,uint32_t *out,uint8_t &outCount) {
  if(!accepted.is<JsonArrayConst>()) return false; JsonArrayConst a=accepted.as<JsonArrayConst>(); if(a.size()>sentCount)return false;
  outCount=0;
  for(JsonVariantConst v:a){if(!v.is<uint32_t>())return false;uint32_t seq=v.as<uint32_t>();bool known=false;for(uint8_t i=0;i<sentCount;i++)if(sent[i]==seq)known=true;for(uint8_t i=0;i<outCount;i++)if(out[i]==seq)return false;if(!known)return false;out[outCount++]=seq;}
  return true;
}
bool validResponse(JsonDocument &ack,uint32_t *sent,uint8_t count,uint32_t *accepted,uint8_t &acceptedCount,Policy &policy) {
  JsonObjectConst obj=ack.as<JsonObjectConst>();
  if(obj.size()!=4) return false;
  if(!validAccepted(obj["accepted"],sent,count,accepted,acceptedCount)) return false;
  if(!obj["intervalMin"].is<float>() || !obj["fullPct"].is<float>() || !obj["heatC"].is<float>()) return false;
  float interval=obj["intervalMin"].as<float>(); float full=obj["fullPct"].as<float>(); float heat=obj["heatC"].as<float>();
  if(!std::isfinite(interval) || interval<=0 || interval>1440 || !std::isfinite(full) || full<0 || full>100 || !std::isfinite(heat) || heat < -40 || heat>125) return false;
  policy=Policy(interval,full,heat); return true;
}
bool deliverHttp(uint8_t count,uint32_t *accepted,uint8_t &acceptedCount,Policy &policy) {
  if(endpoint[0]==0||deviceKey[0]==0){label(F("HTTP disabled: configure endpoint and disposable key at runtime"));return false;}
  if(WiFi.status()!=WL_CONNECTED){WiFi.mode(WIFI_STA);WiFi.begin("Wokwi-GUEST","");uint32_t until=millis()+2500;while(WiFi.status()!=WL_CONNECTED && static_cast<int32_t>(millis()-until)<0)delay(50);}
  if(WiFi.status()!=WL_CONNECTED){label(F("HTTP ERROR: Wokwi-GUEST unavailable; queue retained"));return false;}
  JsonDocument doc; JsonArray arr=doc["readings"].to<JsonArray>(); uint32_t sent[BatchLimit];
  for(uint8_t i=0;i<count;i++){sent[i]=saved.queue.rows[i].seq;JsonDocument item;deserializeJson(item,readingJson(saved.queue.rows[i]));arr.add(item.as<JsonObject>());}
  String body;serializeJson(doc,body); String url=String(endpoint)+"/iot/bins/bin-sim-001/readings";
  HTTPClient http; WiFiClient plain; WiFiClientSecure secure; bool isHttps=url.startsWith("https://");
  if(isHttps){if(tlsInsecure){secure.setInsecure();label(F("TLS UNVERIFIED DEMO: disposable tunnel/key only"));}else{
#if defined(CITYCYCLE_ROOT_CA)
    secure.setCACert(CITYCYCLE_ROOT_CA);
#else
    label(F("TLS trust missing: add public root CA as root_ca.h or explicitly select tls insecure-demo"));return false;
#endif
  } if(!http.begin(secure,url)){label(F("HTTP setup failed"));return false;}}
  else if(url.startsWith("http://")){if(!http.begin(plain,url)){label(F("HTTP setup failed"));return false;}}
  else {label(F("endpoint must begin http:// or https://"));return false;}
  http.setTimeout(3000);http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);const char *responseHeaders[]={"Transfer-Encoding"};http.collectHeaders(responseHeaders,1);http.addHeader("Content-Type","application/json");http.addHeader("X-Device-Key",deviceKey); int code=http.POST(body);
  if(code!=202){Serial.printf("HTTP ERROR status=%d; queue retained\n",code);http.end();return false;}
  char response[MaxAckBodyBytes+1]{};int size=http.getSize();bool chunked=http.header("Transfer-Encoding").equalsIgnoreCase("chunked");
  HttpBodyReader reader(response,MaxAckBodyBytes,size,chunked);WiFiClient *stream=http.getStreamPtr();uint32_t deadline=millis()+3000UL;
  while(stream&&!reader.done()&&!reader.failed()&&static_cast<int32_t>(millis()-deadline)<0){int available=stream->available();if(available>0)reader.feed(static_cast<uint8_t>(stream->read()));else if(!http.connected()){reader.finish();break;}else delay(1);}
  bool bodyReady=reader.done();size_t responseLength=reader.length();http.end();
  if(!bodyReady){label(F("HTTP ERROR: ACK response incomplete, oversized, or timed out; queue retained"));return false;}
  JsonDocument ack;DeserializationError err=deserializeJson(ack,response,responseLength);if(err)return false;
  return validResponse(ack,sent,count,accepted,acceptedCount,policy);
}
bool deliverMock(uint8_t count,uint32_t *accepted,uint8_t &acceptedCount,Policy &policy) {
  Serial.println(F("LOCAL MOCK RECEIVER (no HTTP): exact proposed payload follows"));
  for(uint8_t i=0;i<count;i++)Serial.println(readingJson(saved.queue.rows[i]));
  uint32_t sent[BatchLimit];for(uint8_t i=0;i<count;i++)sent[i]=saved.queue.rows[i].seq;
  acceptedCount=partialNext?(count>1?count/2:0):count;partialNext=false;
  Persisted before=saved;
  for(uint8_t i=0;i<acceptedCount;i++)if(sent[i]>saved.mockLastAccepted)saved.mockLastAccepted=sent[i];
  if(saved.mockLastAccepted!=before.mockLastAccepted&&!saveState()){saved=before;label(F("LOCAL MOCK receiver could not persist; queue retained"));return false;}
  if(failNext){failNext=false;label(F("MOCK RESPONSE LOST after receiver commit; queue retained for idempotent retry"));return false;}
  if(badAckNext&&acceptedCount){accepted[0]=999999;badAckNext=false;}else for(uint8_t i=0;i<acceptedCount;i++)accepted[i]=sent[i];
  policy=mockPolicy;
  if(acceptedCount==0)label(F("MOCK RESPONSE: accepted=[] (valid empty ACK)"));else{Serial.print(F("MOCK RESPONSE: {accepted:["));for(uint8_t i=0;i<acceptedCount;i++){if(i)Serial.print(',');Serial.print(accepted[i]);}Serial.println(F("]}; policy unchanged"));}
  return true;
}
void deliver(bool explicitRequest) {
  if(!saved.queue.count){label(F("OUTBOX EMPTY"));return;}
  if(!storageUsable){label(F("NVS unavailable: delivery disabled"));return;}
  lastBattery=readBattery(); lowPower=lastBattery<3.1f;
  if(!netOn){label(F("NETWORK OFF: outbox retained"));render("OFFLINE QUEUED");return;}
  if(lowPower){label(F("LOW POWER: HTTP suspended; controls can recover"));render("LOW POWER");return;}
  if(!retry.allowed(millis(),explicitRequest)){render("RETRY WAIT");return;}
  if(!deliveryGate.claim())return;
  uint8_t count=saved.queue.count<BatchLimit?saved.queue.count:BatchLimit; uint32_t sent[BatchLimit],accepted[BatchLimit]{};for(uint8_t i=0;i<count;i++)sent[i]=saved.queue.rows[i].seq;
  uint8_t acceptedCount=0; Policy newPolicy{static_cast<float>(saved.intervalMin),static_cast<float>(saved.fullPct),saved.heatC};
  bool ok=httpMode?deliverHttp(count,accepted,acceptedCount,newPolicy):deliverMock(count,accepted,acceptedCount,newPolicy);
  if(!ok){retry.failed(millis(),fastMode);snprintf(lastResult,sizeof(lastResult),"error retry %lus",retryDelaySeconds(retry.failures,fastMode));Serial.printf("RETRY in %lus; queue unchanged\n",retryDelaySeconds(retry.failures,fastMode));render("RETRY");return;}
  Persisted before=saved;
  if(!saved.queue.acknowledge(sent,count,accepted,acceptedCount)){label(F("INVALID ACK: unknown/duplicate sequence; queue retained"));strcpy(lastResult,"invalid ACK; retry scheduled");retry.failed(millis(),fastMode);return;}
  saved.intervalMin=newPolicy.interval_min;saved.fullPct=newPolicy.full_pct;saved.heatC=newPolicy.heat_c;
  if(!saveState()){saved=before;label(F("NVS ACK save failed; queue restored"));retry.failed(millis(),fastMode);return;}
  if(acceptedCount){retry.succeeded();snprintf(lastResult,sizeof(lastResult),"ACK %u confirmed",acceptedCount);Serial.printf("ACK confirmed %u reading(s); pending=%u\n",acceptedCount,saved.queue.count);if(before.intervalMin!=saved.intervalMin)nextSample=millis()+sampleIntervalMs();}
  else {retry.failed(millis(),fastMode);strcpy(lastResult,"empty ACK; retry scheduled");label(F("Empty ACK: retry backoff retained"));}
  render("IDLE / SLEEP");
}
void printHelp(){label(F("Commands: help | status | sample | send | network on|off|auto | solar on|off|auto | mode mock|http | endpoint <baseURL> | key <disposable-key> | tls insecure-demo|verify | timing fast|real | mock policy <minutes> <fullPct> <heatC> | mock partial | mock fail-next | mock bad-ack"));}
void command(String s) {
  s.trim();String lower=s;lower.toLowerCase();
  if(lower=="help"){printHelp();return;} if(lower=="status"){render("STATUS");printQueue();return;} if(lower=="sample"){sampleNow();return;} if(lower=="send"){deliver(true);return;}
  if(lower=="network auto"){netOverride=false;return;} if(lower=="solar auto"){solarOverride=false;return;}
  if(lower=="network on"||lower=="network off"){netOverride=true;netOn=lower.endsWith("on");Serial.println(netOn?F("network override ON"):F("network override OFF"));return;}
  if(lower=="solar on"||lower=="solar off"){solarOverride=true;solarOn=lower.endsWith("on");render("SOLAR OVERRIDE");return;}
  if(lower=="mode mock"){httpMode=false;label(F("LOCAL MOCK mode: no HTTP"));return;} if(lower=="mode http"){httpMode=true;label(F("HTTP mode selected; remains offline until endpoint and key configured"));return;}
  if(lower.startsWith("endpoint ")){String value=s.substring(9);value.trim();if(value.indexOf('@')>=0||value.indexOf('?')>=0||value.indexOf('#')>=0||value.length()>=sizeof(endpoint)){label(F("Invalid endpoint"));return;}value.toCharArray(endpoint,sizeof(endpoint));Serial.print(F("endpoint set: "));Serial.println(endpoint);return;}
  if(lower.startsWith("key ")){String value=s.substring(4);value.trim();if(value.length()==0||value.length()>=sizeof(deviceKey)){label(F("Invalid key length"));return;}value.toCharArray(deviceKey,sizeof(deviceKey));label(F("runtime key set (value hidden and not persisted)"));return;}
  if(lower=="tls insecure-demo"){tlsInsecure=true;label(F("TLS UNVERIFIED DEMO persistent status; disposable key/tunnel only"));return;}if(lower=="tls verify"){tlsInsecure=false;label(F("TLS CA verification required"));return;}
  if(lower=="timing fast"){fastMode=true;nextSample=millis()+sampleIntervalMs();label(F("FAST DEMO timing enabled: 30 minutes = 30 seconds; backoff scaled"));return;}if(lower=="timing real"){fastMode=false;nextSample=millis()+sampleIntervalMs();label(F("REAL-TIME policy intervals in minutes"));return;}
  if(lower=="mock partial"){partialNext=true;label(F("next mock response partially ACKs"));return;}if(lower=="mock fail-next"){failNext=true;label(F("next local mock delivery fails"));return;}if(lower=="mock bad-ack"){badAckNext=true;label(F("next local mock response includes unknown sequence"));return;}
  if(lower.startsWith("mock policy ")){float a,b,c;String rest=s.substring(12);if(sscanf(rest.c_str(),"%f %f %f",&a,&b,&c)==3&&std::isfinite(a)&&a>0&&a<=1440&&std::isfinite(b)&&b>=0&&b<=100&&std::isfinite(c)&&c>=-40&&c<=125){mockPolicy={a,b,c};label(F("local mock receiver policy configured; device applies only after valid response"));}else label(F("policy syntax/range invalid"));return;}
  label(F("Unknown command; type help"));
}
void updateSwitches(){if(!netOverride)netOn=digitalRead(NET_SW)==HIGH;if(!solarOverride)solarOn=digitalRead(SOLAR_SW)==HIGH;}
void setup(){Serial.begin(115200);delay(100);pinMode(TRIG,OUTPUT);pinMode(ECHO,INPUT);pinMode(BATTERY,INPUT);pinMode(NET_SW,INPUT_PULLUP);pinMode(SOLAR_SW,INPUT_PULLUP);pinMode(SAMPLE_BTN,INPUT_PULLUP);pinMode(LED_FULL,OUTPUT);pinMode(LED_HEAT,OUTPUT);pinMode(LED_STATUS,OUTPUT);pinMode(LED_CHARGE,OUTPUT);Wire.begin(21,22);display.begin(SSD1306_SWITCHCAPVCC,0x3C);ds.begin();ds.setWaitForConversion(false);loadState();mockPolicy={saved.intervalMin,saved.fullPct,saved.heatC};printHelp();label(F("SIMULATOR | LOCAL MOCK — NO HTTP | FAST DEMO 30m=30s"));sampleNow();nextSample=millis()+sampleIntervalMs();}
void loop(){deliveryGate.beginLoop();updateSwitches();static bool oldButton=true;static uint32_t debounce=0;bool button=digitalRead(SAMPLE_BTN);if(oldButton&&!button&&millis()-debounce>40){debounce=millis();sampleNow();}oldButton=button;
  while(Serial.available()){char c=Serial.read();if(c=='\n'||c=='\r'){if(line.length()){command(line);line="";}}else if(line.length()<240)line+=c;}
  finishPendingSample();
  static uint32_t powerCheck=0;if(millis()-powerCheck>=500){powerCheck=millis();bool wasLow=lowPower;lastBattery=readBattery();lowPower=lastBattery<3.1f;if(wasLow&&!lowPower&&netOn&&saved.queue.count)deliver(true);}
  uint32_t now=millis();if(static_cast<int32_t>(now-nextSample)>=0){lastBattery=readBattery();lowPower=lastBattery<3.1f;sampleNow();nextSample=millis()+sampleIntervalMs();}
  if(!previousNet&&netOn&&saved.queue.count)deliver(true);previousNet=netOn;
  if(saved.queue.count&&netOn&&!lowPower)deliver(false);static uint32_t lastUi=0;if(millis()-lastUi>1000){render("IDLE / SLEEP");lastUi=millis();}delay(50);
}

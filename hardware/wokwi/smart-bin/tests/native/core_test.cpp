#include "core.h"
#include <cassert>
#include <cmath>

int main() {
  using namespace citycycle;
  assert(fillPercent(100) == 0); assert(fillPercent(5) == 100);
  assert(fillPercent(24) == 80); assert(fillPercent(-1) == -1);
  assert(fillPercent(NAN) == -1);
  ThresholdEdges edges;
  assert(!edges.update(79, 59, 80, 60));
  assert(edges.update(80, 60, 80, 60));
  assert(!edges.update(90, 70, 80, 60));
  assert(!edges.update(79, 59, 80, 60));
  assert(edges.update(80, 59, 80, 60));
  Queue q; Reading r{};
  for (int i = 0; i < QueueCapacity; ++i) assert(q.append(r));
  assert(q.nextSeq == 33 && !q.append(r));
  uint32_t sent[] = {1, 2}, ack[] = {1, 77};
  assert(!q.acknowledge(sent, 2, ack, 2) && q.count == QueueCapacity);
  uint32_t good[] = {1}; assert(q.acknowledge(sent, 2, good, 1));
  assert(q.count == 31 && q.rows[0].seq == 2 && q.rows[0].seq < q.nextSeq);
  assert(retryDelaySeconds(1, false) == 60); assert(retryDelaySeconds(5, false) == 960);
  assert(retryDelaySeconds(5, true) == 16); assert(policyIntervalMs(30, true) == 30000);
  assert(policyIntervalMs(30, false) == 1800000);
  RetrySchedule retry;
  retry.failed(0, true); assert(!retry.allowed(100, false));
  assert(retry.allowed(100, true)); assert(retry.allowed(retry.deadline, false));
  retry.failed(2000, true); assert(!retry.allowed(2001, false));
  retry.succeeded(); assert(retry.allowed(2001, false));
  DeliveryGate loopDelivery; loopDelivery.beginLoop();
  assert(loopDelivery.claim()); assert(!loopDelivery.claim());
  loopDelivery.beginLoop(); assert(loopDelivery.claim());

  RetrySchedule malformed;
  malformed.failed(0, true); malformed.failed(0, true);
  assert(malformed.failures == 2 && !malformed.allowed(1, false));
  ThresholdEdges edgeDuringRetry;
  assert(!edgeDuringRetry.update(79,59,80,60));
  assert(edgeDuringRetry.update(80,60,80,60));
  assert(!malformed.allowed(1,false) && malformed.allowed(1,true));

  ThresholdEdges atomicEdges; Queue atomicQueue; Reading full{}; full.fill=80;
  bool crossed=false;
  assert(atomicQueue.appendWithEdges(full, 61, 80, 60, atomicEdges, crossed));
  assert(crossed && atomicEdges.full && atomicQueue.nextSeq == 2);
  Queue fullQueue; ThresholdEdges fullEdges;
  for (int i=0;i<QueueCapacity;i++) assert(fullQueue.append(Reading{}));
  assert(!fullQueue.appendWithEdges(full,61,80,60,fullEdges,crossed));
  assert(!fullEdges.full && fullQueue.nextSeq == 33);
  Queue savedQueue; ThresholdEdges savedEdges;
  int saveCalls=0;
  auto failedSave=[&](){++saveCalls;return false;};
  assert(appendSampleTransaction(savedQueue,savedEdges,full,61,80,60,failedSave,crossed)==AppendResult::StorageFailed);
  assert(saveCalls==1 && savedQueue.nextSeq==1 && savedQueue.count==0 && !savedEdges.full);
  auto successfulSave=[&](){++saveCalls;return true;};
  assert(appendSampleTransaction(savedQueue,savedEdges,full,61,80,60,successfulSave,crossed)==AppendResult::Saved);
  assert(crossed && saveCalls==2 && savedQueue.nextSeq==2 && savedEdges.full);
  uint32_t foreignSeq=999; assert(!savedQueue.acknowledge(&foreignSeq,1,&foreignSeq,1));

  TemperatureConversion conversion;
  conversion.request(100, 750);
  assert(!conversion.ready(100) && !conversion.ready(849));
  assert(conversion.ready(850));
  conversion.request(2000,750);
  assert(!conversion.ready(2749) && conversion.ready(2750));
  conversion.complete();float sensorValue=85;int reads=0;conversion.request(3000,750);
  auto sensorRead=[&](float &out){++reads;out=sensorValue;return std::isfinite(out)&&out>=-40&&out<=125;};
  float fresh=NAN;assert(completeTemperature(conversion,3000,sensorRead,fresh)==TemperatureResult::Pending&&reads==0);
  sensorValue=61;assert(completeTemperature(conversion,3750,sensorRead,fresh)==TemperatureResult::Valid&&fresh==61&&reads==1);
  conversion.request(4000,750);auto disconnected=[&](float &){++reads;return false;};
  assert(completeTemperature(conversion,4750,disconnected,fresh)==TemperatureResult::Unavailable&&reads==2);

  assert(classifyPersistentLoad(false,false,0,sizeof(Reading),0,true)==LoadDisposition::Failed);
  assert(classifyPersistentLoad(true,false,0,sizeof(Reading),0,false)==LoadDisposition::InitializeMissing);
  assert(classifyPersistentLoad(true,true,sizeof(Reading),sizeof(Reading),sizeof(Reading),true)==LoadDisposition::RestoreExisting);
  assert(classifyPersistentLoad(true,true,sizeof(Reading),sizeof(Reading),0,false)==LoadDisposition::Failed);
  assert(classifyPersistentLoad(true,true,sizeof(Reading),sizeof(Reading),sizeof(Reading),false)==LoadDisposition::Failed);
  assert(classifyPersistentLoad(true,true,sizeof(Reading)-1,sizeof(Reading),sizeof(Reading),true)==LoadDisposition::Failed);
  assert(classifyPersistentLoad(true,true,sizeof(Reading),sizeof(Reading),sizeof(Reading),false)==LoadDisposition::Failed); // bad version/CRC

  char body[64];
  const char fixedJson[]="{\"ok\":1}";
  HttpBodyReader fixedOk(body,sizeof(body),8,false);
  for(char c:fixedJson) if(c) fixedOk.feed(static_cast<uint8_t>(c));
  assert(fixedOk.done() && fixedOk.length()==8);
  HttpBodyReader tooLarge(body,sizeof(body),65,false); assert(tooLarge.failed());
  HttpBodyReader chunked(body,sizeof(body),-1,true);
  const char chunks[]="3\r\nabc\r\n2\r\nde\r\n0\r\n\r\n";
  for(char c:chunks) if(c) chunked.feed(static_cast<uint8_t>(c));
  assert(chunked.done() && chunked.length()==5);
  char tiny[4]; HttpBodyReader oversizedChunk(tiny,sizeof(tiny),-1,true);
  const char tooMany[]="5\r\nabcde\r\n0\r\n\r\n";
  for(char c:tooMany) if(c) oversizedChunk.feed(static_cast<uint8_t>(c));
  assert(oversizedChunk.failed());
  HttpBodyReader truncated(body,sizeof(body),4,false); truncated.feed('{');
  truncated.finish(); assert(truncated.failed());
  HttpBodyReader closeDelimited(body,sizeof(body),-1,false);
  for(char c:fixedJson) if(c) closeDelimited.feed(static_cast<uint8_t>(c));
  closeDelimited.finish(); assert(closeDelimited.done() && closeDelimited.length()==8);
  HttpBodyReader truncatedChunk(body,sizeof(body),-1,true);
  truncatedChunk.feed('3');truncatedChunk.feed('\r');truncatedChunk.feed('\n');truncatedChunk.feed('a');
  truncatedChunk.finish();assert(truncatedChunk.failed());
  HttpBodyReader hugeChunk(body,sizeof(body),-1,true);
  const char huge[]="ffffffff\r\n";for(char c:huge)if(c)hugeChunk.feed(static_cast<uint8_t>(c));
  assert(hugeChunk.failed());
}

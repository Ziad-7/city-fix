#pragma once
#include <cmath>
#include <cstdint>

namespace citycycle {
constexpr uint8_t QueueCapacity = 32;
constexpr uint8_t BatchLimit = 8;
constexpr size_t MaxAckBodyBytes = 1024;
struct Policy {
  float interval_min, full_pct, heat_c;
  Policy(float interval=30, float full=80, float heat=60)
    : interval_min(interval), full_pct(full), heat_c(heat) {}
};

inline int fillPercent(float cm) {
  if (!std::isfinite(cm) || cm < 0) return -1;
  if (cm <= 5) return 100;
  if (cm >= 100) return 0;
  return static_cast<int>(std::lround((100.0f - cm) * 100.0f / 95.0f));
}

struct ThresholdEdges {
  bool full = false;
  bool heat = false;
  bool update(int fill, float temp, float fullPct, float heatC) {
    const bool nextFull = fill >= fullPct;
    const bool nextHeat = std::isfinite(temp) ? temp >= heatC : heat;
    const bool crossed = (nextFull && !full) || (nextHeat && !heat);
    full = nextFull; heat = nextHeat;
    return crossed;
  }
};

inline uint32_t retryDelaySeconds(uint8_t failures, bool fast);
struct RetrySchedule {
  uint8_t failures = 0;
  uint32_t deadline = 0;
  bool waiting = false;
  bool allowed(uint32_t now, bool explicitBypass) const {
    return explicitBypass || !waiting || static_cast<int32_t>(now-deadline) >= 0;
  }
  void failed(uint32_t now, bool fast) {
    if (failures < 5) ++failures;
    deadline = now + retryDelaySeconds(failures, fast) * 1000UL;
    waiting = true;
  }
  void succeeded() { failures=0; waiting=false; }
};
struct DeliveryGate {
  bool attempted = false;
  void beginLoop() { attempted=false; }
  bool claim() { if (attempted) return false; attempted=true; return true; }
};

enum class LoadDisposition { Failed, InitializeMissing, RestoreExisting };
inline LoadDisposition classifyPersistentLoad(bool began, bool exists,
                                               size_t actualLength, size_t expectedLength,
                                               size_t bytesRead, bool valid) {
  if (!began) return LoadDisposition::Failed;
  if (!exists) return LoadDisposition::InitializeMissing;
  if (actualLength != expectedLength || bytesRead != expectedLength || !valid)
    return LoadDisposition::Failed;
  return LoadDisposition::RestoreExisting;
}

struct TemperatureConversion {
  bool pending = false;
  uint32_t readyAt = 0;
  void request(uint32_t now, uint32_t conversionMs) {
    pending=true; readyAt=now+conversionMs;
  }
  bool ready(uint32_t now) const {
    return pending && static_cast<int32_t>(now-readyAt)>=0;
  }
  void complete() { pending=false; }
};
enum class TemperatureResult { Pending, Valid, Unavailable };
template <typename Read>
TemperatureResult completeTemperature(TemperatureConversion &conversion,uint32_t now,
                                      Read read,float &value) {
  if(!conversion.ready(now))return TemperatureResult::Pending;
  conversion.complete();
  return read(value)?TemperatureResult::Valid:TemperatureResult::Unavailable;
}

struct Reading {
  uint32_t seq = 0;
  float fill = 0, distance = 0, temp = 0, battery = 0;
  int16_t rssi = -127;
  uint8_t flags = 0; // bit 0: temperature valid; bit 1: distance valid
};

struct Queue {
  uint32_t nextSeq = 1;
  uint8_t count = 0;
  Reading rows[QueueCapacity]{};

  bool append(const Reading &input) {
    if (count >= QueueCapacity || nextSeq == 0) return false;
    Reading r = input;
    r.seq = nextSeq++;
    rows[count++] = r;
    return true;
  }
  bool appendWithEdges(const Reading &input, float temp, float fullPct, float heatC,
                       ThresholdEdges &edges, bool &crossed) {
    Queue candidate=*this;
    ThresholdEdges candidateEdges=edges;
    crossed=candidateEdges.update(static_cast<int>(input.fill),temp,fullPct,heatC);
    if (!candidate.append(input)) return false;
    *this=candidate; edges=candidateEdges; return true;
  }
  bool acknowledge(const uint32_t *sent, uint8_t sentCount,
                   const uint32_t *accepted, uint8_t acceptedCount) {
    if (sentCount > BatchLimit || acceptedCount > sentCount) return false;
    bool known[BatchLimit]{};
    for (uint8_t i = 0; i < sentCount; ++i) {
      for (uint8_t j = i + 1; j < sentCount; ++j)
        if (sent[i] == sent[j]) return false;
      bool inQueue = false;
      for (uint8_t q = 0; q < count; ++q) if (rows[q].seq == sent[i]) inQueue = true;
      if (!inQueue) return false;
    }
    for (uint8_t a = 0; a < acceptedCount; ++a) {
      bool found = false;
      for (uint8_t s = 0; s < sentCount; ++s) if (accepted[a] == sent[s]) {
        if (known[s]) return false;
        known[s] = true; found = true;
      }
      if (!found) return false;
    }
    uint8_t out = 0;
    for (uint8_t q = 0; q < count; ++q) {
      bool erase = false;
      for (uint8_t s = 0; s < sentCount; ++s)
        if (known[s] && rows[q].seq == sent[s]) erase = true;
      if (!erase) rows[out++] = rows[q];
    }
    count = out;
    return true;
  }
};

enum class AppendResult { Saved, Full, StorageFailed };
template <typename Save>
AppendResult appendSampleTransaction(Queue &queue, ThresholdEdges &edges,
                                     const Reading &reading, float temp,
                                     float fullPct, float heatC, Save save,
                                     bool &crossed) {
  Queue beforeQueue=queue; ThresholdEdges beforeEdges=edges;
  if (!queue.appendWithEdges(reading,temp,fullPct,heatC,edges,crossed)) return AppendResult::Full;
  if (!save()) { queue=beforeQueue; edges=beforeEdges; return AppendResult::StorageFailed; }
  return AppendResult::Saved;
}

class HttpBodyReader {
 public:
  enum class State { Fixed, CloseDelimited, ChunkSize, ChunkData, ChunkCr, ChunkLf, Trailer, Done, Failed };
  HttpBodyReader(char *buffer, size_t capacity, int contentLength, bool chunked)
      : buffer_(buffer), capacity_(capacity), state_(State::Failed), expected_(0),
        chunkRemaining_(0), lineLength_(0), trailerBytes_(0), length_(0) {
    if (!buffer_ || capacity_==0 || contentLength < -1) return;
    if (chunked) state_=State::ChunkSize;
    else if (contentLength >= 0) {
      if (static_cast<size_t>(contentLength) > capacity_) return;
      expected_=static_cast<size_t>(contentLength); state_=expected_==0?State::Done:State::Fixed;
    } else state_=State::CloseDelimited;
  }
  bool invalid() const { return state_==State::Failed; }
  bool done() const { return state_==State::Done; }
  bool failed() const { return state_==State::Failed; }
  size_t length() const { return length_; }
  void feed(uint8_t byte) {
    if (done() || failed()) return;
    switch (state_) {
      case State::Fixed:
        if (!append(byte)) return;
        if (length_==expected_) state_=State::Done;
        return;
      case State::CloseDelimited:
        append(byte); return;
      case State::ChunkSize:
        if (byte=='\n') { parseChunkSize(); return; }
        if (lineLength_>=sizeof(line_)-1) { state_=State::Failed; return; }
        line_[lineLength_++]=static_cast<char>(byte); return;
      case State::ChunkData:
        if (!append(byte)) return;
        if (--chunkRemaining_==0) state_=State::ChunkCr;
        return;
      case State::ChunkCr:
        if (byte!='\r') { state_=State::Failed; return; }
        state_=State::ChunkLf; return;
      case State::ChunkLf:
        if (byte!='\n') { state_=State::Failed; return; }
        state_=State::ChunkSize; lineLength_=0; return;
      case State::Trailer:
        if (++trailerBytes_>256 || lineLength_>=sizeof(line_)-1) { state_=State::Failed; return; }
        if (byte=='\n') {
          if (lineLength_==1 && line_[0]=='\r') { state_=State::Done; return; }
          lineLength_=0; return;
        }
        line_[lineLength_++]=static_cast<char>(byte); return;
      case State::Done: case State::Failed: return;
    }
  }
  void finish() {
    if (state_==State::CloseDelimited) state_=State::Done;
    else if (state_!=State::Done) state_=State::Failed;
  }
 private:
  char *buffer_; size_t capacity_; State state_; size_t expected_, chunkRemaining_;
  char line_[24]{}; size_t lineLength_, trailerBytes_, length_;
  bool append(uint8_t byte) {
    if (length_>=capacity_) { state_=State::Failed; return false; }
    buffer_[length_++]=static_cast<char>(byte); return true;
  }
  void parseChunkSize() {
    line_[lineLength_]='\0';
    char *end=line_;
    size_t value=0; bool any=false;
    while (*end && *end!=';' && *end!='\r') {
      unsigned digit;
      if (*end>='0'&&*end<='9') digit=static_cast<unsigned>(*end-'0');
      else if (*end>='a'&&*end<='f') digit=static_cast<unsigned>(*end-'a'+10);
      else if (*end>='A'&&*end<='F') digit=static_cast<unsigned>(*end-'A'+10);
      else { state_=State::Failed; return; }
      const size_t remaining=capacity_-length_;
      if (digit>remaining || value>(remaining-digit)/16) { state_=State::Failed; return; }
      value=value*16+digit; any=true; ++end;
    }
    if (!any) { state_=State::Failed; return; }
    lineLength_=0;
    if (value==0) { state_=State::Trailer; return; }
    chunkRemaining_=value; state_=State::ChunkData;
  }
};

inline uint32_t retryDelaySeconds(uint8_t failures, bool fast) {
  const uint8_t shift = failures == 0 ? 0 : (failures > 5 ? 4 : failures - 1);
  const uint32_t seconds = 60UL << shift;
  return fast ? (seconds / 60UL) : seconds;
}

inline uint32_t policyIntervalMs(float minutes, bool fast) {
  float seconds=fast?minutes:minutes*60.0f;
  return static_cast<uint32_t>(seconds*1000.0f);
}

inline uint32_t crc32(const void *data, size_t length) {
  const uint8_t *p = static_cast<const uint8_t *>(data);
  uint32_t crc = 0xFFFFFFFFUL;
  while (length--) {
    crc ^= *p++;
    for (uint8_t i = 0; i < 8; ++i) crc = (crc >> 1) ^ (0xEDB88320UL & (-(crc & 1UL)));
  }
  return ~crc;
}
}

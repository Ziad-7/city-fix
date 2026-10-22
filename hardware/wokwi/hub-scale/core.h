#pragma once
#include <cmath>
#include <cstdint>

namespace citycycle_scale {
constexpr uint8_t QueueCapacity = 32;
enum class LoadDisposition { Failed, InitializeMissing, RestoreExisting };
inline LoadDisposition classifyPersistentLoad(bool began,bool exists,size_t actualLength,
                                               size_t expectedLength,size_t bytesRead,bool valid) {
  if(!began)return LoadDisposition::Failed;
  if(!exists)return LoadDisposition::InitializeMissing;
  if(actualLength!=expectedLength||bytesRead!=expectedLength||!valid)return LoadDisposition::Failed;
  return LoadDisposition::RestoreExisting;
}
inline bool validMaterialId(const char *value) {
  if (!value) return false;
  constexpr const char *allowed[]={"pet_plastic","paper_cardboard","metal_cans","glass","e_waste","cooking_oil","organics"};
  for (const char *candidate:allowed) {
    const char *a=value,*b=candidate;
    while (*a && *a==*b) { ++a; ++b; }
    if (*a=='\0' && *b=='\0') return true;
  }
  return false;
}
struct Weighing { uint32_t seq = 0; float kg = 0; char material[24]{}; char pickup[40]{}; };
struct Queue {
  uint32_t nextSeq = 1; uint8_t count = 0; Weighing rows[QueueCapacity]{};
  bool append(float kg, const char *material, const char *pickup = "") {
    if (!std::isfinite(kg) || kg <= 0 || kg > 500 || !validMaterialId(material) || count >= QueueCapacity) return false;
    Weighing w{}; w.seq = nextSeq++; w.kg = kg;
    copy(w.material, sizeof(w.material), material); copy(w.pickup, sizeof(w.pickup), pickup ? pickup : "");
    rows[count++] = w; return true;
  }
  void acknowledgeOldest() { if (count) { for (uint8_t i=1; i<count; ++i) rows[i-1]=rows[i]; --count; } }
 private:
  static void copy(char *dst, size_t n, const char *src) {
    size_t i=0; for (; i+1<n && src[i]; ++i) dst[i]=src[i]; dst[i]='\0';
  }
};
inline bool stableWeight(const float *samples, uint8_t count, float &mean) {
  if (!samples || count < 3) return false;
  mean = 0; float lo=samples[0], hi=samples[0];
  for (uint8_t i=0; i<count; ++i) {
    if (!std::isfinite(samples[i]) || samples[i] < 0) return false;
    mean += samples[i]; if (samples[i] < lo) lo=samples[i]; if (samples[i] > hi) hi=samples[i];
  }
  mean /= count;
  return hi-lo <= 0.15f && mean > 0;
}
inline bool validCalibration(float knownKg, float rawDelta) {
  return std::isfinite(knownKg) && knownKg > 0 && knownKg <= 500 && std::isfinite(rawDelta) && rawDelta > 0;
}
inline uint32_t crc32(const void *data, size_t length) {
  const uint8_t *p=static_cast<const uint8_t *>(data); uint32_t crc=0xFFFFFFFFUL;
  while (length--) { crc^=*p++; for (uint8_t i=0;i<8;++i) crc=(crc>>1)^(0xEDB88320UL&(-(crc&1UL))); }
  return ~crc;
}
}

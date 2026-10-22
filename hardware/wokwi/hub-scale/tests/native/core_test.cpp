#include "core.h"
#include <cassert>
#include <cmath>
#include <limits>
int main() {
  using namespace citycycle_scale;
  Queue q; assert(!q.append(-1,"pet_plastic")); assert(!q.append(NAN,"pet_plastic"));
  assert(!q.append(1,"banana")); assert(!q.append(1,"PET_PLASTIC"));
  assert(q.append(2.5f,"pet_plastic","pickup-1")); assert(q.rows[0].seq==1);
  assert(q.rows[0].kg==2.5f && q.rows[0].pickup[0]=='p'); q.acknowledgeOldest();
  assert(q.count==0 && q.nextSeq==2);
  float stable[]={1.00f,1.04f,0.98f}; float mean=0; assert(stableWeight(stable,3,mean));
  float unstable[]={1,1.4f,1}; assert(!stableWeight(unstable,3,mean));
  float bad[]={1,-1,1}; assert(!stableWeight(bad,3,mean));
  assert(validCalibration(5,2100)); assert(!validCalibration(0,2100)); assert(!validCalibration(5,-1));
  const char *allowed[]={"pet_plastic","paper_cardboard","metal_cans","glass","e_waste","cooking_oil","organics"};
  for(const char *value:allowed) assert(validMaterialId(value));
  assert(!validMaterialId("banana")); assert(!validMaterialId("PET_PLASTIC"));
  assert(!validMaterialId("")); assert(!validMaterialId(nullptr));
  assert(classifyPersistentLoad(false,false,0,sizeof(Weighing),0,true)==LoadDisposition::Failed);
  assert(classifyPersistentLoad(true,false,0,sizeof(Weighing),0,false)==LoadDisposition::InitializeMissing);
  assert(classifyPersistentLoad(true,true,sizeof(Weighing),sizeof(Weighing),0,false)==LoadDisposition::Failed);
  assert(classifyPersistentLoad(true,true,sizeof(Weighing),sizeof(Weighing),sizeof(Weighing),false)==LoadDisposition::Failed);
  assert(classifyPersistentLoad(true,true,sizeof(Weighing)-1,sizeof(Weighing),sizeof(Weighing),true)==LoadDisposition::Failed);
  assert(classifyPersistentLoad(true,true,sizeof(Weighing),sizeof(Weighing),sizeof(Weighing),true)==LoadDisposition::RestoreExisting);
}

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { WasteClassification } from '@/domain/citycycle';

const fake = vi.hoisted(() => ({ classify: vi.fn(), upload: vi.fn(), loadPrices: vi.fn(), create: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/services', () => ({ services: { uploads: { upload: fake.upload }, waste: { classify: fake.classify } } }));
vi.mock('@/lib/photo', () => ({ compressImage: async () => 'data:image/jpeg;base64,photo' }));
vi.mock('@/lib/location', () => ({ useReportLocation: () => ({ place: {lat:30.07,lng:31.36,address:'test'},state:'ready',locate:vi.fn(),setAddress:vi.fn(),setLandmark:vi.fn(),setPoint:vi.fn() }) }));
vi.mock('@/lib/area', () => ({ useAreaCenter: () => ({lat:30.07,lng:31.36}) }));
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('@/store', () => ({
 useSession: (pick: (s: unknown) => unknown) => pick({prefs:{dataSaver:false}}),
 useRecycling: (pick: (s: unknown) => unknown) => pick({prices:[],loadPrices:fake.loadPrices,createPickup:fake.create}),
}));
vi.mock('@/ui/citycycle', () => ({ DemoPricesNote:()=>null, MaterialGrid:()=>null }));
vi.mock('@/ui/DayPicker', () => ({DayPicker:()=>null}));
vi.mock('../../app/(portal)/report/new/parts', () => ({LocationCard:()=>null,VoiceRow:()=>null}));
vi.mock('../../app/(portal)/services/recycling/parts', () => ({
 EstimateCard:()=>null, WeightRows:()=>null,
 PhotoBlock: ({onFiles,onRemove,suggestion}: {onFiles:(f:File[])=>void;onRemove:()=>void;suggestion:{state:string}}) => React.createElement('div',null,
  React.createElement('button',{type:'button','data-testid':'choose-photo',onClick:()=>onFiles([new File(['photo'],'photo.jpg',{type:'image/jpeg'})])},'Choose'),
  React.createElement('button',{type:'button','data-testid':'remove-photo',onClick:onRemove},'Remove'),
  React.createElement('span',{'data-testid':'suggestion-state'},suggestion.state)),
}));
import Page from '../../app/(portal)/services/recycling/page';
let host: HTMLDivElement;let root:Root;
beforeEach(async()=>{
 vi.stubGlobal('React',React);vi.clearAllMocks();fake.upload.mockResolvedValue('photos/me/photo.jpg');fake.classify.mockResolvedValue({materials:[{materialId:'pet_plastic',confidence:0.9}],size:'medium',source:'ai'});
 (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
 host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(React.createElement(Page)));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()});
async function click(id:string){const el=host.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);expect(el).not.toBeNull();await act(async()=>el!.click())}
it('keeps photo analysis private until opt-in, then sends explicit consent and clears results when revoked',async()=>{
 await click('choose-photo');expect(fake.upload).not.toHaveBeenCalled();expect(fake.classify).not.toHaveBeenCalled();
 await click('toggle-waste-photo-consent');expect(fake.classify).toHaveBeenCalledWith('photos/me/photo.jpg',true);expect(host.querySelector('[data-testid="suggestion-state"]')?.textContent).toBe('ready');
 await click('toggle-waste-photo-consent');expect(host.querySelector('[data-testid="suggestion-state"]')?.textContent).toBe('none');
});
it('ignores an in-flight analysis result after consent is revoked',async()=>{
 let finish!:(value:WasteClassification)=>void;fake.classify.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));
 await click('toggle-waste-photo-consent');await click('choose-photo');expect(fake.classify).toHaveBeenCalledTimes(1);
 await click('toggle-waste-photo-consent');await act(async()=>finish({materials:[{materialId:'pet_plastic',confidence:0.9}],size:'medium',source:'fallback'}));
 expect(host.querySelector('[data-testid="suggestion-state"]')?.textContent).toBe('none');
});

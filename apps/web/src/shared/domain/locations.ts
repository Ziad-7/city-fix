import type { Place } from './types';

export type District = {
  id: string;
  nameAr: string;
  lat: number;
  lng: number;
  /** Feeds the "area equity" factor of the priority score. */
  underserved: boolean;
};
export type Governorate = { id: string; nameAr: string; districts: District[] };

export const GOVERNORATES: Governorate[] = [
  {
    id: 'cairo',
    nameAr: 'القاهرة',
    districts: [
      { id: 'nasr-1', nameAr: 'مدينة نصر أول', lat: 30.056, lng: 31.33, underserved: false },
      { id: 'nasr-2', nameAr: 'مدينة نصر ثان', lat: 30.075, lng: 31.345, underserved: false },
      { id: 'heliopolis', nameAr: 'مصر الجديدة', lat: 30.09, lng: 31.32, underserved: false },
      { id: 'maadi', nameAr: 'المعادي', lat: 29.96, lng: 31.26, underserved: false },
      { id: 'ain-shams', nameAr: 'عين شمس', lat: 30.131, lng: 31.332, underserved: true },
      { id: 'shubra', nameAr: 'شبرا', lat: 30.11, lng: 31.245, underserved: true },
    ],
  },
  {
    id: 'giza',
    nameAr: 'الجيزة',
    districts: [
      { id: 'dokki', nameAr: 'الدقي', lat: 30.038, lng: 31.211, underserved: false },
      { id: 'mohandessin', nameAr: 'المهندسين', lat: 30.056, lng: 31.2, underserved: false },
      { id: 'haram', nameAr: 'الهرم', lat: 29.988, lng: 31.17, underserved: false },
      { id: 'faisal', nameAr: 'فيصل', lat: 29.99, lng: 31.15, underserved: true },
      { id: 'imbaba', nameAr: 'إمبابة', lat: 30.077, lng: 31.208, underserved: true },
    ],
  },
  {
    id: 'alexandria',
    nameAr: 'الإسكندرية',
    districts: [
      { id: 'sidi-gaber', nameAr: 'سيدي جابر', lat: 31.22, lng: 29.94, underserved: false },
      { id: 'montaza', nameAr: 'المنتزه', lat: 31.28, lng: 30.02, underserved: false },
      { id: 'agamy', nameAr: 'العجمي', lat: 31.1, lng: 29.77, underserved: true },
    ],
  },
  {
    id: 'qalyubia',
    nameAr: 'القليوبية',
    districts: [
      { id: 'shubra-kheima', nameAr: 'شبرا الخيمة', lat: 30.128, lng: 31.242, underserved: true },
      { id: 'banha', nameAr: 'بنها', lat: 30.466, lng: 31.185, underserved: false },
      { id: 'qanater', nameAr: 'القناطر الخيرية', lat: 30.19, lng: 31.13, underserved: true },
    ],
  },
];

export const DEFAULT_GOVERNORATE = 'القاهرة';
export const DEFAULT_DISTRICT = 'مدينة نصر أول';

/** Fallback map point (Nasr City) when GPS is unavailable or denied. */
export const DEFAULT_PLACE: Place = {
  lat: 30.056,
  lng: 31.33,
  address: 'شارع عباس العقاد، مدينة نصر',
};

export const findGovernorate = (nameAr: string) => GOVERNORATES.find((g) => g.nameAr === nameAr);
export const findDistrict = (govNameAr: string, districtNameAr: string) =>
  findGovernorate(govNameAr)?.districts.find((d) => d.nameAr === districtNameAr);

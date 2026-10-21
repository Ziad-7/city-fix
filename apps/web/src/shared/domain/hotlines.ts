export type Hotline = {
  number: string;
  labelAr: string;
  group: 'emergency' | 'utility';
  /** Visual tone: urgent-soft (emergency), gold-soft (gas), or neutral (utility). */
  tone: 'urgent' | 'gold' | 'plain';
};

export const HOTLINES: Hotline[] = [
  { number: '122', labelAr: 'شرطة', group: 'emergency', tone: 'urgent' },
  { number: '123', labelAr: 'إسعاف', group: 'emergency', tone: 'urgent' },
  { number: '180', labelAr: 'مطافي', group: 'emergency', tone: 'urgent' },
  { number: '129', labelAr: 'غاز', group: 'emergency', tone: 'gold' },
  { number: '125', labelAr: 'مياه', group: 'utility', tone: 'plain' },
  { number: '121', labelAr: 'كهربا', group: 'utility', tone: 'plain' },
  { number: '175', labelAr: 'صرف', group: 'utility', tone: 'plain' },
];

export const getHotline = (number: string) => HOTLINES.find((h) => h.number === number);

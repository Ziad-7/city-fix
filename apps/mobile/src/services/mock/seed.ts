import { getCategory } from '@/domain/categories';
import { findDistrict } from '@/domain/locations';
import type { CategoryId, Incident, IncidentStatus, Report, ServiceRequest, Severity } from '@/domain/types';
import { nextWorkingDays } from '@/domain/services-catalog';
import { computePriority } from '@/logic/priority';
import { etaFor, incidentTimelineEntry, serviceTimelineEntry, STATUS_ORDER, type DbTimelineEntry } from './timeline';

export const DEMO_USER_ID = 'demo-user';

/**
 * The mock database rows carry English text next to the Arabic (the real backend localises by Accept-Language).
 * The services return the plain API types: see ./localize.ts, which picks a language and strips these fields.
 */
export type DbIncident = Omit<Incident, 'timeline'> & { timeline: DbTimelineEntry[]; titleEn?: string; addressEn?: string };
export type DbReport = Report & { descriptionEn?: string; addressEn?: string; landmarkEn?: string };
export type DbServiceRequest = Omit<ServiceRequest, 'timeline'> & { timeline: DbTimelineEntry[]; addressEn?: string; landmarkEn?: string };

export type MockDb = {
  incidents: DbIncident[];
  reports: DbReport[];
  serviceRequests: DbServiceRequest[];
  /** userId -> incident ids the user follows */
  following: Record<string, string[]>;
  counters: { incident: number; report: number; service: number };
};

const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

type SeedRow = {
  n: number;
  categoryId: CategoryId;
  title: string;
  titleEn: string;
  address: string;
  addressEn: string;
  lat: number;
  lng: number;
  status: IncidentStatus;
  severity: Severity;
  ageH: number;
  followers: number;
  reporters: number;
  sensitivePlace?: string;
  underserved?: boolean;
  workOrder?: string;
};

const ROWS: SeedRow[] = [
  { n: 501, categoryId: 'pothole', title: 'حفرة في شارع عباس العقاد', titleEn: 'Pothole on Abbas El Akkad St', address: 'شارع عباس العقاد، مدينة نصر', addressEn: 'Abbas El Akkad St, Nasr City', lat: 30.0562, lng: 31.3305, status: 'in_progress', severity: 'high', ageH: 2, followers: 7, reporters: 7, sensitivePlace: 'مدرسة النصر الإعدادية', workOrder: 'WO-318' },
  { n: 502, categoryId: 'open_manhole', title: 'بالوعة مفتوحة في شارع حسن المأمون', titleEn: 'Open manhole on Hassan El Maamoun St', address: 'شارع حسن المأمون، مدينة نصر', addressEn: 'Hassan El Maamoun St, Nasr City', lat: 30.0575, lng: 31.329, status: 'assigned', severity: 'critical', ageH: 30, followers: 12, reporters: 12, workOrder: 'WO-321' },
  { n: 503, categoryId: 'streetlight_out', title: 'عمود نور مطفي في شارع مكرم عبيد', titleEn: 'Streetlight out on Makram Ebeid St', address: 'شارع مكرم عبيد، مدينة نصر', addressEn: 'Makram Ebeid St, Nasr City', lat: 30.054, lng: 31.3335, status: 'resolved', severity: 'low', ageH: 54, followers: 2, reporters: 2 },
  { n: 504, categoryId: 'garbage', title: 'زبالة متراكمة في شارع الطيران', titleEn: 'Garbage piling up on El Tayaran St', address: 'شارع الطيران، مدينة نصر', addressEn: 'El Tayaran St, Nasr City', lat: 30.059, lng: 31.335, status: 'received', severity: 'medium', ageH: 5, followers: 3, reporters: 3 },
  { n: 505, categoryId: 'sewage_overflow', title: 'طفح مجاري قدام عمارة ١٢', titleEn: 'Sewage overflow in front of building 12', address: 'شارع الحجاز، مدينة نصر', addressEn: 'El Hegaz St, Nasr City', lat: 30.052, lng: 31.327, status: 'assigned', severity: 'high', ageH: 40, followers: 5, reporters: 4, workOrder: 'WO-324' },
  { n: 506, categoryId: 'water_pipe_burst', title: 'كسر ماسورة مياه في شارع الثورة', titleEn: 'Burst water pipe on El Thawra St', address: 'شارع الثورة، مدينة نصر', addressEn: 'El Thawra St, Nasr City', lat: 30.061, lng: 31.331, status: 'in_progress', severity: 'high', ageH: 20, followers: 9, reporters: 6, workOrder: 'WO-326' },
  { n: 507, categoryId: 'exposed_wire', title: 'سلك كهربا مكشوف جنب الحديقة', titleEn: 'Exposed electric wire next to the park', address: 'شارع يوسف عباس، مدينة نصر', addressEn: 'Youssef Abbas St, Nasr City', lat: 30.055, lng: 31.338, status: 'received', severity: 'critical', ageH: 1, followers: 1, reporters: 1, sensitivePlace: 'حديقة الأطفال' },
  { n: 508, categoryId: 'fallen_tree', title: 'شجرة مايلة على الرصيف', titleEn: 'Leaning tree on the sidewalk', address: 'شارع مصطفى النحاس، مدينة نصر', addressEn: 'Mostafa El Nahas St, Nasr City', lat: 30.05, lng: 31.333, status: 'resolved', severity: 'medium', ageH: 100, followers: 4, reporters: 3 },
  { n: 509, categoryId: 'broken_sidewalk', title: 'رصيف مكسور قدام المستشفى', titleEn: 'Broken sidewalk in front of the hospital', address: 'شارع أحمد فخري، مدينة نصر', addressEn: 'Ahmed Fakhry St, Nasr City', lat: 30.058, lng: 31.326, status: 'assigned', severity: 'medium', ageH: 72, followers: 6, reporters: 5, sensitivePlace: 'مستشفى المبرة' },
  { n: 510, categoryId: 'stray_dogs', title: 'كلاب ضالة جنب المدرسة', titleEn: 'Stray dogs near the school', address: 'شارع الطيران، مدينة نصر', addressEn: 'El Tayaran St, Nasr City', lat: 30.053, lng: 31.33, status: 'triaged', severity: 'medium', ageH: 12, followers: 3, reporters: 2, sensitivePlace: 'مدرسة الطيران الابتدائية' },
];

function buildIncident(row: SeedRow, now: number): DbIncident {
  const cat = getCategory(row.categoryId);
  const createdMs = now - row.ageH * HOUR;
  const base = {
    categoryId: row.categoryId,
    severity: row.severity,
    department: cat.department,
  };
  const upTo = STATUS_ORDER.indexOf(row.status);
  const steps = Math.max(1, upTo + 1);
  const span = Math.max(HOUR, now - createdMs - HOUR / 2);
  const timeline = STATUS_ORDER.slice(0, steps).map((st, i) =>
    incidentTimelineEntry(st, base, iso(createdMs + (steps > 1 ? (span * i) / (steps - 1) : 0))),
  );
  const linked = Array.from({ length: row.reporters }, (_, i) => (i === 0 && row.n === 501 ? 'FTC-1042' : `FTC-${String(800 + (row.n - 500) * 10 + i).padStart(4, '0')}`));
  const underserved = row.underserved ?? findDistrict('القاهرة', 'مدينة نصر أول')?.underserved ?? false;
  const priority = computePriority({
    severity: row.severity,
    nearSensitivePlace: !!row.sensitivePlace,
    reporters: row.reporters,
    daysOpen: Math.floor(row.ageH / 24),
    targetDays: cat.targetDays,
    areaUnderserved: underserved,
  });
  return {
    id: `INC-${row.n}`,
    ...base,
    title: row.title,
    titleEn: row.titleEn,
    addressEn: row.addressEn,
    priority,
    status: row.status,
    estimatedCostEgp: cat.estimatedCostEgp,
    linkedReportIds: linked,
    followers: row.followers,
    location: { lat: row.lat, lng: row.lng, address: row.address },
    sensitivePlace: row.sensitivePlace,
    areaUnderserved: underserved,
    workOrderId: row.workOrder,
    eta: etaFor(row.status),
    timeline,
    createdAt: iso(createdMs),
    updatedAt: timeline[timeline.length - 1].at,
  };
}

/** Seed: 10 incidents around Nasr City, 1 report and 1 service request for the demo user. */
export function buildSeed(now: number = Date.now()): MockDb {
  const incidents = ROWS.map((r) => buildIncident(r, now));
  const pothole = incidents[0];
  const reports: DbReport[] = [
    {
      id: 'FTC-1042',
      reporterId: DEMO_USER_ID,
      incidentId: pothole.id,
      categoryId: 'pothole',
      description: 'فيه حفرة كبيرة قدام المدرسة والعربيات بتقع فيها كل يوم',
      descriptionEn: 'There is a big pothole in front of the school and cars fall into it every day',
      photoUris: [],
      location: { ...pothole.location, landmark: 'قدام مدرسة النصر الإعدادية' },
      addressEn: pothole.addressEn,
      landmarkEn: 'In front of El Nasr Preparatory School',
      anonymous: false,
      blurFaces: true,
      createdAt: pothole.createdAt,
    },
  ];
  const created = now - 5 * HOUR;
  const serviceRequests: DbServiceRequest[] = [
    {
      id: 'SRV-2001',
      citizenId: DEMO_USER_ID,
      serviceType: 'bulky_waste',
      details: { items: ['كنبة', 'تلاجة قديمة'], day: nextWorkingDays(1, new Date(now))[0], slot: 'morning', payment: 'cash' },
      location: { lat: 30.056, lng: 31.33, address: 'شارع عباس العقاد، مدينة نصر', landmark: 'عمارة ١٢' },
      addressEn: 'Abbas El Akkad St, Nasr City',
      landmarkEn: 'Building 12',
      status: 'assigned',
      timeline: [
        serviceTimelineEntry('received', iso(created)),
        serviceTimelineEntry('assigned', iso(created + 2 * HOUR)),
      ],
      createdAt: iso(created),
    },
  ];
  return {
    incidents,
    reports,
    serviceRequests,
    following: {},
    counters: { incident: 511, report: 1043, service: 2002 },
  };
}

/**
 * A database saved by an older build has no English text. Fills it in for the seed rows (matched by id) so a
 * returning install shows English too. Rows made by the user have no English text and are derived at read time.
 */
export function withEnglish(db: MockDb): MockDb {
  const seed = buildSeed();
  for (const i of db.incidents) {
    const s = i.titleEn ? undefined : seed.incidents.find((x) => x.id === i.id);
    if (s) {
      i.titleEn = s.titleEn;
      i.addressEn = s.addressEn;
    }
  }
  for (const r of db.reports) {
    const s = r.descriptionEn ? undefined : seed.reports.find((x) => x.id === r.id);
    if (s) Object.assign(r, { descriptionEn: s.descriptionEn, addressEn: s.addressEn, landmarkEn: s.landmarkEn });
  }
  for (const r of db.serviceRequests) {
    const s = r.addressEn ? undefined : seed.serviceRequests.find((x) => x.id === r.id);
    if (s) Object.assign(r, { addressEn: s.addressEn, landmarkEn: s.landmarkEn });
  }
  return db;
}

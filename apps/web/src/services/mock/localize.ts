import { getCategory } from '@/domain/categories';
import type { Incident, Report, ServiceRequest, TimelineEntry } from '@/domain/types';
import { getLang } from '@/i18n';
import { CATEGORY_EN } from '@/i18n/labels';
import type { DbIncident, DbReport, DbServiceRequest } from './seed';
import { etaFor, incidentTimelineEntry, serviceTimelineEntry, type DbTimelineEntry } from './timeline';

/**
 * Read-time localisation for the mock backend: like the real one, it answers in the language of the request
 * (here: the app language) and returns the plain API types, with no internal fields.
 */

const HAS_ARABIC = /[؀-ۿ]/;

function entryView(e: DbTimelineEntry, regenerate: () => DbTimelineEntry): TimelineEntry {
  if (getLang() !== 'en') return { status: e.status, note: e.note, actor: e.actor, at: e.at };
  if (e.noteEn && e.actorEn) return { status: e.status, note: e.noteEn, actor: e.actorEn, at: e.at };
  // Saved by an older build, without English text.
  if (e.actor === 'مواطن') {
    return { status: e.status, note: e.note.replace('اتفتح تاني', 'Reopened'), actor: 'Citizen', at: e.at };
  }
  const fresh = regenerate();
  return { status: e.status, note: fresh.noteEn ?? e.note, actor: fresh.actorEn ?? e.actor, at: e.at };
}

/** "Pothole or rough speed bump · Abbas El Akkad St" from the category, when no English title was stored. */
function derivedTitleEn(i: DbIncident): string {
  const label = CATEGORY_EN[i.categoryId] ?? getCategory(i.categoryId).labelAr;
  const place = i.location.address?.split(/[,،]/)[0]?.trim();
  return place && !HAS_ARABIC.test(place) ? `${label} · ${place}` : label;
}

export function incidentView(i: DbIncident): Incident {
  const { titleEn, addressEn, timeline, ...rest } = i;
  const en = getLang() === 'en';
  return {
    ...rest,
    title: en ? (titleEn ?? derivedTitleEn(i)) : i.title,
    location: en && addressEn ? { ...i.location, address: addressEn } : i.location,
    eta: en && i.eta ? etaFor(i.status, 'en') : i.eta,
    timeline: timeline.map((e) => entryView(e, () => incidentTimelineEntry(e.status, i, e.at))),
  };
}

export function reportView(r: DbReport): Report {
  const { descriptionEn, addressEn, landmarkEn, ...rest } = r;
  if (getLang() !== 'en') return rest;
  return {
    ...rest,
    description: descriptionEn ?? r.description,
    location: { ...r.location, address: addressEn ?? r.location.address, landmark: landmarkEn ?? r.location.landmark },
  };
}

export function requestView(r: DbServiceRequest): ServiceRequest {
  const { addressEn, landmarkEn, timeline, ...rest } = r;
  const en = getLang() === 'en';
  return {
    ...rest,
    location: en ? { ...r.location, address: addressEn ?? r.location.address, landmark: landmarkEn ?? r.location.landmark } : r.location,
    timeline: timeline.map((e) => entryView(e, () => serviceTimelineEntry(e.status, e.at, r.serviceType))),
  };
}

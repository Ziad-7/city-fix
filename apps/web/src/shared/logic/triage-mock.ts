import { CATEGORIES, getCategory } from '@/domain/categories';
import type { CategoryId, Severity, TriageOption, TriageSuggestion } from '@/domain/types';
import { SEVERITY_LABEL_AR } from '@/domain/types';
import { categoryLabel, departmentLabel, severityLabel, tr } from '@/i18n';

/** Normalise Arabic for matching: strip diacritics/tatweel, unify alef/yaa/taa-marbuta. */
export function normalizeAr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Egyptian-Arabic keyword stems per category (matched as substrings after normalisation). */
const KEYWORDS: Record<CategoryId, string[]> = {
  pothole: ['حفره', 'حفر', 'مطب', 'اسفلت', 'الاسفلت', 'نتوء', 'العربيات بتقع', 'هبوط'],
  open_manhole: ['بلوعه', 'بالوعه', 'غطا', 'غطاء', 'مطبق', 'منهول', 'مفتوحه'],
  sewage_overflow: ['طفح', 'مجاري', 'صرف', 'ريحه مجاري', 'مياه سوده', 'غرقان', 'بيطفح'],
  water_pipe_burst: ['ماسوره', 'مواسير', 'كسر', 'مياه بتطلع', 'مايه', 'ميه', 'تسريب', 'بتنزل مياه', 'غرق'],
  garbage: ['زبال', 'قمام', 'مخلفات', 'القمامه', 'نفايات', 'تلال', 'كوم'],
  streetlight_out: ['عمود نور', 'نور', 'انار', 'مطفي', 'ضلمه', 'مضلم', 'لمبه', 'كشاف'],
  exposed_wire: ['سلك', 'اسلاك', 'كهربا', 'كهرباء', 'شرر', 'صعق', 'كابل', 'عريان', 'مكشوف'],
  road_obstruction: ['اشغال', 'اشغالات', 'تعدي', 'كراسي', 'بياعين', 'سد الطريق', 'مقفول', 'عربيه واقفه', 'صف تاني'],
  stray_dogs: ['كلب', 'كلاب', 'ضاله', 'ضالة', 'بتعض', 'نباح'],
  fallen_tree: ['شجره', 'شجر', 'فرع', 'مايله', 'واقعه', 'وقعت'],
  broken_sidewalk: ['رصيف', 'بلاط', 'مكسور', 'الرصيف', 'بلاطه'],
  other: [],
};

/**
 * English stems for people using the app in English. Matched at the start of a word (so "tree" does not fire on
 * "street"); a trailing plural or suffix is fine. Arabic text never matches these, so Arabic results are unchanged.
 */
const KEYWORDS_EN: Record<CategoryId, string[]> = {
  pothole: ['pothole', 'speed bump', 'asphalt', 'hole in the road'],
  open_manhole: ['manhole', 'drain cover', 'missing cover', 'open drain'],
  sewage_overflow: ['sewage', 'sewer', 'overflow', 'drain smell'],
  water_pipe_burst: ['pipe', 'burst', 'water leak', 'leaking water', 'water main', 'flood'],
  garbage: ['garbage', 'trash', 'rubbish', 'litter', 'waste'],
  streetlight_out: ['streetlight', 'street light', 'lamp', 'light is out', 'lights are out', 'dark'],
  exposed_wire: ['wire', 'cable', 'spark', 'electric', 'live wire'],
  road_obstruction: ['blocked', 'blocking', 'obstruct', 'double parked', 'encroach'],
  stray_dogs: ['dog', 'stray', 'bite', 'bark'],
  fallen_tree: ['tree', 'branch', 'fallen', 'leaning'],
  broken_sidewalk: ['sidewalk', 'pavement', 'tile', 'curb'],
  other: [],
};
const ESCALATE_EN = ['school', 'children', 'kids', 'students', 'hospital', 'accident', 'danger', 'urgent', 'every day', 'people fall', 'cars fall'];
const DE_ESCALATE_EN = ['small', 'minor', 'slight'];

/** Whole-word-start match for English stems ("dog" matches "dogs", "tree" does not match "street"). */
const hasEnglish = (text: string, stem: string): boolean => new RegExp(`(^|[^a-z])${stem}`).test(text);

const ESCALATE = ['مدرسه', 'مدرسة', 'اطفال', 'عيال', 'طلاب', 'مستشفي', 'ناس بتقع', 'حادث', 'خطر', 'شرر', 'مات', 'وقع حد', 'بتقع كل يوم', 'عاجل'];
const DE_ESCALATE = ['بسيطه', 'صغيره', 'خفيفه'];
const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];
const shift = (s: Severity, by: number): Severity =>
  SEVERITIES[Math.min(SEVERITIES.length - 1, Math.max(0, SEVERITIES.indexOf(s) + by))];

/**
 * Emergency vocabulary (gas, fire, injury, collapse), normalised. Matched on WHOLE WORDS (an optional و/ب/ل/ال
 * prefix is allowed) so that "دم" does not fire on "هدم" and "وقع" does not fire on "بتقع" in a pothole report.
 */
const EMERGENCY_WORDS = [
  'غاز', 'حريقه', 'حريق', 'نار', 'دخان', 'اتعور', 'اتصاب', 'مصاب', 'مصابين', 'اصابه', 'دم', 'نزيف',
  'وقع', 'انهيار', 'انهار', 'انفجار', 'اتفجر', 'مولع', 'بيولع',
];
/** English emergency vocabulary (whole words), for descriptions typed in English. */
const EMERGENCY_WORDS_EN = [
  'gas', 'fire', 'smoke', 'burning', 'flames', 'injured', 'injury', 'hurt', 'bleeding', 'blood', 'collapse', 'collapsed',
  'collapsing', 'explosion', 'exploded', 'electrocuted', 'unconscious',
];
const EMERGENCY_PHRASES = ['حد اتعور', 'بيت واقع', 'عماره بتقع', 'بيت بيقع', 'عماره واقعه', 'سقف وقع', 'ريحه غاز', 'ريحة غاز', 'تسريب غاز'];
const PREFIXES = ['', 'و', 'ب', 'ل', 'ال', 'وال', 'بال', 'ف'];

/** True when the text mentions gas, fire, an injury or a collapse (Egyptian Arabic or English wording). */
export function detectEmergency(description: string): boolean {
  const text = normalizeAr(description).replace(/[^ء-يa-z0-9]+/g, ' ');
  if (!text) return false;
  const padded = ` ${text} `;
  if (EMERGENCY_PHRASES.some((p) => padded.includes(` ${normalizeAr(p)} `))) return true;
  const tokens = text.split(' ');
  if (tokens.some((t) => EMERGENCY_WORDS_EN.includes(t))) return true;
  return tokens.some((t) => EMERGENCY_WORDS.some((w) => PREFIXES.some((p) => t === p + w)));
}

export type TriageInput = {
  description: string;
  /** Category picked by the citizen on the previous step (a strong prior). */
  categoryId?: CategoryId;
};

/**
 * Deterministic stand-in for the AI classifier. Returns the top-3 categories with
 * confidences that sum to <= 1, a severity and a one-line summary in the current language (Arabic or English; Egyptian Arabic keywords plus a short English list).
 * `duplicates` is left empty here; the TriageService fills it from open incidents.
 */
export function triageMock(input: TriageInput): TriageSuggestion {
  const text = normalizeAr(input.description);
  const scores = CATEGORIES.map((c) => {
    const hits =
      [...new Set(KEYWORDS[c.id].map(normalizeAr))].filter((k) => text.includes(k)).length + KEYWORDS_EN[c.id].filter((k) => hasEnglish(text, k)).length;
    const prior = input.categoryId === c.id ? 4 : 0;
    return { id: c.id, score: 0.2 + hits * 3 + prior, hits };
  });
  const total = scores.reduce((s, x) => s + x.score, 0);
  const ranked = [...scores].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 3);
  const options: TriageOption[] = ranked.map((r) => ({
    categoryId: r.id,
    confidence: Math.floor((r.score / total) * 100) / 100,
  }));

  const top = getCategory(options[0].categoryId);
  let severity = top.defaultSeverity;
  const up = ESCALATE.some((k) => text.includes(normalizeAr(k))) || ESCALATE_EN.some((k) => hasEnglish(text, k));
  const down = DE_ESCALATE.some((k) => text.includes(normalizeAr(k))) || DE_ESCALATE_EN.some((k) => hasEnglish(text, k));
  if (up) severity = shift(severity, 1);
  else if (down && !top.danger) severity = shift(severity, -1);
  if (top.danger && SEVERITIES.indexOf(severity) < SEVERITIES.indexOf('high')) severity = 'high';

  const emergency = detectEmergency(input.description);
  if (emergency) severity = 'critical';

  const summary = tr(
    `الغالب إنها "${top.labelAr}" — ${SEVERITY_LABEL_AR[severity]}، وهتروح لـ${top.department}.`,
    `Most likely “${categoryLabel(top.id, top.labelAr)}” — ${severityLabel(severity, SEVERITY_LABEL_AR[severity])}. It will go to ${departmentLabel(top.department)}.`,
  );
  return { options, severity, summary, duplicates: [], source: 'fallback', emergency };
}

/** Return a useful offline suggestion only when a keyword match or citizen category gives evidence. */
export function triageOfflineFallback(input: TriageInput): TriageSuggestion | null {
  const suggestion = triageMock(input);
  if (
    !input.categoryId &&
    suggestion.options[0].confidence <= suggestion.options[1].confidence
  ) {
    return null;
  }
  return suggestion;
}

const RAW_SEVERITY = /\b(low|medium|high|critical)\b/i;

/** Summary line in the current language, built from the top option and severity (never a raw enum value). */
export function triageSummaryFor(s: Pick<TriageSuggestion, 'options' | 'severity'>): string {
  const top = getCategory(s.options[0]?.categoryId ?? 'other');
  return tr(
    `الغالب إنها "${top.labelAr}" — ${SEVERITY_LABEL_AR[s.severity]}، وهتروح لـ${top.department}.`,
    `Most likely “${categoryLabel(top.id, top.labelAr)}” — ${severityLabel(s.severity, SEVERITY_LABEL_AR[s.severity])}. It will go to ${departmentLabel(top.department)}.`,
  );
}

/**
 * Server summaries can carry the raw enum ("... — high، ..."), and English UI gets an Arabic line.
 * Rebuild the line locally when it shows a raw severity word or the language does not match.
 */
export function cleanTriageSummary(s: TriageSuggestion): TriageSuggestion {
  if (!s.options.length) return s;
  const english = /[A-Za-z]{3}/.test(s.summary) && !/[؀-ۿ]/.test(s.summary);
  const wantsEnglish = tr('ar', 'en') === 'en';
  if (RAW_SEVERITY.test(s.summary) || (s.summary && english !== wantsEnglish && s.source !== 'model')) {
    return { ...s, summary: triageSummaryFor(s) };
  }
  return s;
}

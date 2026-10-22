import { HOTLINES } from '@/domain/hotlines';
import { hotlineLabel, useTr } from '@/i18n';
import { localDigits } from '@/utils/digits';
import { Icon } from './Icon';

const emergency = HOTLINES.filter((h) => h.group === 'emergency');
const utility = HOTLINES.filter((h) => h.group === 'utility');

/** The four emergency numbers as big tap targets (`.w-sos`). */
export function SosGrid() {
  const tr = useTr();
  return (
    <div className="w-sos">
      {emergency.map((h) => (
        <a key={h.number} className={h.tone === 'gold' ? 'gas' : undefined} href={`tel:${h.number}`} aria-label={tr(`اتصل ${h.labelAr} ${localDigits(h.number)}`, `Call ${hotlineLabel(h)} ${h.number}`)}>
          <b><bdi dir="ltr">{localDigits(h.number)}</bdi></b>
          <span>{hotlineLabel(h)}</span>
        </a>
      ))}
    </div>
  );
}

/** "فيه خطر على حياة حد؟" box: police, ambulance, fire, and the gas advice line (category page and picker). */
export function EmergencyBox() {
  const tr = useTr();
  const calls = emergency.filter((h) => h.tone === 'urgent');
  return (
    <section className="c-box" aria-label={tr('طوارئ', 'Emergency')}>
      <div className="c-box__top">
        <span className="ftc-icon-well"><Icon name="alert-triangle" size={22} /></span>
        {tr('فيه خطر على حياة حد؟ متبلّغش هنا، كلّم فورًا', 'Is someone in danger? Don’t report it here. Call now')}
      </div>
      <div className="c-calls">
        {calls.map((h) => (
          <a key={h.number} className="c-call" href={`tel:${h.number}`} aria-label={tr(`اتصل ${h.labelAr} ${localDigits(h.number)}`, `Call ${hotlineLabel(h)} ${h.number}`)}>
            <Icon name="phone" size={20} /><bdi dir="ltr">{localDigits(h.number)}</bdi> <span>{hotlineLabel(h)}</span>
          </a>
        ))}
      </div>
      <div className="c-gas">
        <Icon name="alert-triangle" size={20} />
        <span><b>{tr('ريحة غاز؟', 'Smell gas?')}</b> {tr('اقفل المحبس، افتح الشبابيك، اطلع برّه، وكلّم طوارئ الغاز.', 'Turn off the valve, open the windows, get outside, and call the gas emergency line.')}</span>
        <a href="tel:129" aria-label={tr('اتصل طوارئ الغاز ١٢٩', 'Call gas emergency 129')}><Icon name="phone" size={18} /><bdi dir="ltr">{localDigits('129')}</bdi></a>
      </div>
    </section>
  );
}

/** "المية أو الكهربا قاطعة؟" card with the utility hotlines. */
export function UtilityCard() {
  const tr = useTr();
  return (
    <div className="ftc-card c-util">
      <span className="ftc-icon-well"><Icon name="zap" size={20} /></span>
      <div className="tx">
        <b>{tr('المية أو الكهربا قاطعة؟', 'Water or power out?')}</b>
        <span>{tr('الانقطاع بتحلّه شركة المرافق مباشرة. إحنا هنسجّل بلاغك برضه، بس الأسرع تكلمهم.', 'The utility company fixes outages directly. We’ll log your report too, but calling them is faster.')}</span>
      </div>
      <div className="btns">
        {utility.map((h) => (
          <a key={h.number} href={`tel:${h.number}`} aria-label={tr(`اتصل ${h.labelAr} ${localDigits(h.number)}`, `Call ${hotlineLabel(h)} ${h.number}`)}>
            <bdi dir="ltr">{localDigits(h.number)}</bdi> <span>{hotlineLabel(h)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

import { HOTLINES } from '@/domain/hotlines';
import { toArabicDigits } from '@/utils/digits';
import { Icon } from './Icon';

const emergency = HOTLINES.filter((h) => h.group === 'emergency');
const utility = HOTLINES.filter((h) => h.group === 'utility');

/** The four emergency numbers as big tap targets (`.w-sos`). */
export function SosGrid() {
  return (
    <div className="w-sos">
      {emergency.map((h) => (
        <a key={h.number} className={h.tone === 'gold' ? 'gas' : undefined} href={`tel:${h.number}`} aria-label={`اتصل ${h.labelAr} ${toArabicDigits(h.number)}`}>
          <b>{toArabicDigits(h.number)}</b>
          <span>{h.labelAr}</span>
        </a>
      ))}
    </div>
  );
}

/** "فيه خطر على حياة حد؟" box: police, ambulance, fire, and the gas advice line (category page and picker). */
export function EmergencyBox() {
  const calls = emergency.filter((h) => h.tone === 'urgent');
  return (
    <section className="c-box" aria-label="طوارئ">
      <div className="c-box__top">
        <span className="ftc-icon-well"><Icon name="alert-triangle" size={22} /></span>
        فيه خطر على حياة حد؟ متبلّغش هنا، كلّم فورًا
      </div>
      <div className="c-calls">
        {calls.map((h) => (
          <a key={h.number} className="c-call" href={`tel:${h.number}`} aria-label={`اتصل ${h.labelAr} ${toArabicDigits(h.number)}`}>
            <Icon name="phone" size={20} />{toArabicDigits(h.number)} <span>{h.labelAr}</span>
          </a>
        ))}
      </div>
      <div className="c-gas">
        <Icon name="alert-triangle" size={20} />
        <span><b>ريحة غاز؟</b> اقفل المحبس، افتح الشبابيك، اطلع برّه، وكلّم طوارئ الغاز.</span>
        <a href="tel:129" aria-label="اتصل طوارئ الغاز ١٢٩"><Icon name="phone" size={18} />١٢٩</a>
      </div>
    </section>
  );
}

/** "المية أو الكهربا قاطعة؟" card with the utility hotlines. */
export function UtilityCard() {
  return (
    <div className="ftc-card c-util">
      <span className="ftc-icon-well"><Icon name="zap" size={20} /></span>
      <div className="tx">
        <b>المية أو الكهربا قاطعة؟</b>
        <span>الانقطاع بتحلّه شركة المرافق مباشرة. إحنا هنسجّل بلاغك برضه، بس الأسرع تكلمهم.</span>
      </div>
      <div className="btns">
        {utility.map((h) => (
          <a key={h.number} href={`tel:${h.number}`} aria-label={`اتصل ${h.labelAr} ${toArabicDigits(h.number)}`}>
            {toArabicDigits(h.number)} <span>{h.labelAr}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

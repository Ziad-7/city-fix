'use client';

import Link from 'next/link';
import { MATERIAL_IDS, materialDo, materialDont, materialLabel } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { usePageTitle } from '@/lib/usePageTitle';
import { MaterialBadge } from '@/ui/citycycle';
import { Icon } from '@/ui/Icon';

/** Sorting guide: for each material, what to put out and what to keep out. Open to signed-out visitors. */
export default function RecyclingGuidePage() {
  const tr = useTr();
  usePageTitle(tr('دليل الفرز', 'Sorting guide'));
  return (
    <main className="ftc-web-main" id="main">
      <div className="w-page-head">
        <div>
          <h1 className="w-h1">{tr('دليل الفرز', 'Sorting guide')}</h1>
          <p className="w-sub">{tr('الفرز الصح بيزوّد سعر خاماتك وبيسهّل على الجامع.', 'Sorting well raises the value of your materials and makes the collector’s job easier.')}</p>
        </div>
      </div>
      <div className="cc-guide">
        {MATERIAL_IDS.map((id) => (
          <section key={id} className="cc-guide__card" data-testid={`guide-${id}`} aria-labelledby={`guide-h-${id}`}>
            <div className="cc-guide__head">
              <MaterialBadge id={id} size={44} on />
              <h2 id={`guide-h-${id}`}>{materialLabel(id)}</h2>
            </div>
            <p className="cc-guide__line cc-guide__do"><Icon name="check" size={16} /><span><span className="w-sr">{tr('اعمل: ', 'Do: ')}</span>{materialDo(id)}</span></p>
            <p className="cc-guide__line cc-guide__dont"><Icon name="x" size={16} /><span><span className="w-sr">{tr('متعملش: ', "Don't: ")}</span>{materialDont(id)}</span></p>
          </section>
        ))}
      </div>
      <div className="cc-guide__tools cc-noprint">
        <Link className="ftc-btn ftc-btn--primary" href="/services/recycling" data-testid="guide-request"><Icon name="recycle" size={18} />{tr('اطلب جمع تدوير', 'Request a pickup')}</Link>
        <button type="button" className="ftc-btn ftc-btn--secondary" data-testid="guide-print" onClick={() => { if (typeof window !== 'undefined') window.print(); }}>{tr('اطبع الدليل', 'Print the guide')}</button>
      </div>
    </main>
  );
}

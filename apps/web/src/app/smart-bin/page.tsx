'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { BinState } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { emptied, FULL_PCT, HEAT_C, LOW_BATTERY_V, simBinState, START, type SimBin } from '@/lib/smart-bin';
import { usePageTitle } from '@/lib/usePageTitle';
import { localDigits } from '@/utils/digits';
import { BinStateChip, SmartBinFigure } from '@/ui/citycycle';
import { ToggleRow } from '@/ui/controls';
import { Icon } from '@/ui/Icon';

/** Smart bin demo: change what the bin senses and see what the city does. Browser only, nothing is sent anywhere. */
export default function SmartBinPage() {
  const tr = useTr();
  usePageTitle(tr('الصندوق الذكي', 'Smart bin'));
  const [bin, setBin] = useState<SimBin>(START);
  const [justEmptied, setJustEmptied] = useState(false);
  const state = simBinState(bin);

  const change = (patch: Partial<SimBin>) => {
    setBin((b) => ({ ...b, ...patch }));
    setJustEmptied(false);
  };

  const sentence: Record<BinState, string> = {
    ok: tr('الصندوق شغال وفيه مكان.', 'The bin is working and has room.'),
    full: tr('الصندوق اتملى. بيبعت تنبيه للحي لوحده.', 'The bin is full. It alerts the district by itself.'),
    hot: tr(`الصندوق سخن جدًا. ده ممكن يكون حريق. لو فيه دخان، كلّم المطافي ${localDigits(180)}.`, `The bin is very hot. It could be a fire. If there is smoke, call the fire brigade on ${localDigits(180)}.`),
    low_battery: tr('بطارية الصندوق ضعيفة. فريق الصيانة بياخد تنبيه يغيّرها.', 'The bin’s battery is weak. The maintenance team gets an alert to change it.'),
    offline: tr('الصندوق مش لاقي شبكة. بيحفظ قراءاته ويبعتها أول ما الشبكة ترجع.', 'The bin has no signal. It keeps its readings and sends them when the signal is back.'),
  };

  const needsPickup = state === 'full' || state === 'hot';
  const steps: { text: string; cls: string }[] = [
    { text: tr('الصندوق بيبعت تنبيه', 'The bin sends an alert'), cls: needsPickup || justEmptied ? 'is-done' : '' },
    {
      text: state === 'hot' ? tr('الحي بيبعت حد يشوفه فورًا', 'The district sends someone to check it now') : tr('الحي بيضيفه لخط سير عربية الجمع', 'The district adds it to the collection truck’s route'),
      cls: justEmptied ? 'is-done' : needsPickup ? 'is-now' : '',
    },
    { text: justEmptied ? tr('اتفضّى ✓', 'Emptied') : tr('العربية بتفضّيه ويرجع أخضر', 'The truck empties it and it turns green again'), cls: justEmptied ? 'is-done' : '' },
  ];

  const fillLabel = `${localDigits(bin.fillPct)}${tr('٪', '%')}`;
  const tempLabel = `${localDigits(bin.tempC)}°`;

  return (
    <main className="ftc-web-main" id="main">
      <div className="w-page-head">
        <div>
          <h1 className="w-h1">{tr('الصندوق الذكي', 'Smart bin')}</h1>
          <p className="w-sub">{tr('جرّب بنفسك: غيّر حالة الصندوق وشوف المدينة هتعمل إيه.', 'Try it: change the bin and see what the city does.')}</p>
        </div>
        <span className="ftc-chip ftc-chip--received">{tr('تجربة في المتصفح', 'Browser demo')}</span>
      </div>

      <div className="cc-sb">
        <div className="cc-sb-side">
          <div className="ftc-card cc-sb-figure">
            <SmartBinFigure fillPct={bin.fillPct} state={state} />
          </div>
          <p className="cc-sb-status" role="status" aria-live="polite" data-testid="sb-status">
            <BinStateChip state={state} />
            <span>{sentence[state]}</span>
          </p>
        </div>

        <div className="cc-sb-main">
          <section className="ftc-card cc-sb-controls" aria-label={tr('التحكم في الصندوق', 'Bin controls')}>
            <div className="cc-sb-ctl">
              <label className="ftc-label" htmlFor="sb-fill">{tr('قد إيه مليان', 'How full')}</label>
              <span className="cc-sb-val">{fillLabel}</span>
              <input
                id="sb-fill" type="range" min={0} max={100} step={5} value={bin.fillPct} data-testid="sb-fill"
                aria-valuetext={fillLabel}
                onChange={(e) => change({ fillPct: Number(e.target.value) })}
              />
            </div>
            <div className="cc-sb-ctl">
              <label className="ftc-label" htmlFor="sb-temp">{tr('الحرارة جوه الصندوق', 'Temperature inside')}</label>
              <span className="cc-sb-val">{tempLabel}</span>
              <input
                id="sb-temp" type="range" min={20} max={70} step={1} value={bin.tempC} data-testid="sb-temp"
                aria-valuetext={tempLabel}
                onChange={(e) => change({ tempC: Number(e.target.value) })}
              />
            </div>
            <ToggleRow icon="zap" title={tr('البطارية ضعيفة', 'Weak battery')} on={bin.lowBattery} onChange={(v) => change({ lowBattery: v })} testId="sb-battery" bare />
            <ToggleRow icon="wifi" title={tr('الشبكة مقطوعة', 'No signal')} on={!bin.online} onChange={(v) => change({ online: !v })} testId="sb-offline" bare />
            <div className="cc-sb-actions">
              <button
                type="button" className="ftc-btn ftc-btn--primary" disabled={bin.fillPct === 0} data-testid="sb-empty"
                onClick={() => { setBin(emptied); setJustEmptied(true); }}
              >
                <Icon name="trash" size={18} />{tr('فضّي الصندوق', 'Empty the bin')}
              </button>
              <button type="button" className="ftc-btn ftc-btn--secondary" data-testid="sb-reset" onClick={() => { setBin(START); setJustEmptied(false); }}>
                <Icon name="refresh" size={18} />{tr('ابدأ من الأول', 'Start over')}
              </button>
            </div>
          </section>

          <section className="cc-sb-city" aria-labelledby="sb-city-h">
            <h2 className="w-h2" id="sb-city-h">{tr('المدينة بتعمل إيه؟', 'What does the city do?')}</h2>
            <ol className="cc-sb-steps">
              {steps.map((s, i) => (
                <li key={i} className={s.cls}>
                  <span className="cc-sb-num" aria-hidden="true">{s.cls === 'is-done' ? <Icon name="check" size={16} /> : localDigits(i + 1)}</span>
                  <span>{s.text}</span>
                </li>
              ))}
            </ol>
            {state === 'ok' && !justEmptied ? (
              <p className="ftc-help">{tr(`حرّك «قد إيه مليان» لـ${localDigits(FULL_PCT)}٪ أو أكتر وشوف هيحصل إيه`, `Move “How full” to ${FULL_PCT}% or more and see what happens`)}</p>
            ) : null}
          </section>
        </div>
      </div>

      <p className="ftc-help cc-sb-note" data-testid="sb-note">
        {tr(
          `دي محاكاة في المتصفح. مفيش صندوق حقيقي ولا بيانات بتتبعت لأي سيرفر. حدود التنبيه (${localDigits(FULL_PCT)}٪ مليان، ${localDigits(HEAT_C)}° حرارة، بطارية أقل من ${localDigits(String(LOW_BATTERY_V).replace('.', '٫'))} فولت) هي الإعدادات الافتراضية في نظام سيتي سايكل.`,
          `This is a browser simulation. There is no real bin, and nothing is sent to any server. The alert limits (${FULL_PCT}% full, ${HEAT_C}° heat, battery under ${LOW_BATTERY_V} V) are CityCycle’s default settings.`,
        )}
      </p>
      <div className="cc-sb-actions">
        <Link className="ftc-btn ftc-btn--secondary" href="/map" data-testid="sb-map">
          <Icon name="map" size={18} />{tr('شوف الصناديق على الخريطة', 'See bins on the map')}
        </Link>
        <a className="ftc-btn ftc-btn--secondary" href="https://github.com/Ziad-7/city-fix/blob/main/hardware/README.md" target="_blank" rel="noopener noreferrer" data-testid="sb-built">
          <Icon name="info" size={18} />{tr('إزاي اتصنع', 'How it’s built')}
        </a>
      </div>
    </main>
  );
}

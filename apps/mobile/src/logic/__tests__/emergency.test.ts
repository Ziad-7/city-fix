import { detectEmergency, triageMock } from '../triage-mock';

describe('emergency detection', () => {
  const emergencyTexts = [
    'فيه ريحة غاز جامدة في السلم',
    'في حريقة في المحل اللي جنبنا',
    'نار طالعة من العمارة',
    'دخان كتير طالع من البدروم',
    'حد اتعور في الحادثة',
    'فيه مصابين قدام المدرسة',
    'في دم على الرصيف',
    'السقف وقع على الناس',
    'انهيار جزئي في العمارة',
    'بيت واقع في الشارع الجانبي',
    'عمارة بتقع ولازم حد يتدخل',
  ];
  it.each(emergencyTexts)('flags "%s"', (text) => {
    const r = triageMock({ description: text });
    expect(r.emergency).toBe(true);
    expect(r.source).toBe('fallback');
    expect(r.severity).toBe('critical');
    expect(detectEmergency(text)).toBe(true);
  });

  const calmTexts = [
    'فيه حفرة كبيرة قدام المدرسة والعربيات بتقع فيها كل يوم',
    'زبالة متراكمة جنب العمارة',
    'عمود النور مطفي من أسبوع',
    'الشجرة وقعت على الرصيف',
    'بيهدموا العمارة اللي قدام البيت',
    '',
  ];
  it.each(calmTexts)('does not flag "%s"', (text) => {
    const r = triageMock({ description: text });
    expect(r.emergency).toBe(false);
    expect(r.source).toBe('fallback');
  });
});

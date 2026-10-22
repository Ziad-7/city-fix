import { MAP_PIN_ADDRESS, addressAfterMove, formatAddress } from './address';
import { MAX_VOICE_SECONDS, appendTranscript, formatTimer } from './voice';

describe('formatTimer', () => {
  it('uses Arabic-Indic digits, mm:ss', () => {
    expect(formatTimer(0)).toBe('٠٠:٠٠');
    expect(formatTimer(7)).toBe('٠٠:٠٧');
    expect(formatTimer(65.9)).toBe('٠١:٠٥');
    expect(formatTimer(MAX_VOICE_SECONDS)).toBe('٠٠:٣٠');
  });
  it('clamps bad input', () => {
    expect(formatTimer(-3)).toBe('٠٠:٠٠');
    expect(formatTimer(NaN)).toBe('٠٠:٠٠');
  });
});

describe('appendTranscript', () => {
  it('fills an empty description', () => expect(appendTranscript('', ' فيه حفرة ')).toBe('فيه حفرة'));
  it('appends on a new line without losing typed text', () => expect(appendTranscript('قدام المدرسة  ', 'فيه حفرة')).toBe('قدام المدرسة\nفيه حفرة'));
  it('ignores an empty transcript', () => expect(appendTranscript('abc', '  ')).toBe('abc'));
});

describe('address formatting', () => {
  it('joins street and area', () => expect(formatAddress({ street: 'شارع عباس العقاد', district: 'مدينة نصر' })).toBe('شارع عباس العقاد، مدينة نصر'));
  it('falls back to name and city', () => expect(formatAddress({ street: null, name: 'شارع زاكر حسين', city: 'مدينة نصر' })).toBe('شارع زاكر حسين، مدينة نصر'));
  it('returns empty when nothing useful', () => {
    expect(formatAddress(null)).toBe('');
    expect(formatAddress({ street: ' ', district: '' })).toBe('');
    expect(formatAddress({ name: 'ab' })).toBe('');
  });
  it('after a pin move: geocoded, else previous, else the generic label', () => {
    expect(addressAfterMove('شارع النصر', 'قديم')).toBe('شارع النصر');
    expect(addressAfterMove('', 'قديم')).toBe('قديم');
    expect(addressAfterMove('', '  ')).toBe(MAP_PIN_ADDRESS);
  });
});

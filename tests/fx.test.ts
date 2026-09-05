import { describe, expect, it } from 'vitest';
import { animatedNumber, easeOutCubic, formatByKind, interpolate } from '../src/ui/fx';

describe('숫자 트윈', () => {
  it('이징은 0에서 1로 단조 증가한다', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    let prev = 0;
    for (let t = 0.1; t <= 1; t += 0.1) {
      const value = easeOutCubic(t);
      expect(value).toBeGreaterThanOrEqual(prev);
      prev = value;
    }
  });

  it('보간은 양끝을 지킨다', () => {
    expect(interpolate(100, 200, 0)).toBe(100);
    expect(interpolate(100, 200, 1)).toBe(200);
    expect(interpolate(100, 200, 0.5)).toBeCloseTo(150, 6);
  });

  it('종류별 포맷이 화면 표기와 같다', () => {
    expect(formatByKind('won', 1_234_567)).toBe('1,234,567원');
    expect(formatByKind('shortWon', 108_000_000)).toBe('1.08억원');
    expect(formatByKind('shortWon', 4_500_000)).toBe('450만원');
    expect(formatByKind('percent', 0.1234)).toBe('12%');
    expect(formatByKind('signedPercent', 0.0345)).toBe('+3.5%');
    expect(formatByKind('signedPercent', -0.02)).toBe('-2.0%');
  });

  it('애니메이션 마크업은 시작·끝 값과 종류를 담고 끝 값을 먼저 보여 준다', () => {
    const html = animatedNumber('won', 100, 250);
    expect(html).toContain('data-anim="won"');
    expect(html).toContain('data-from="100"');
    expect(html).toContain('data-to="250"');
    expect(html).toContain('>250원<');
    expect(animatedNumber('percent', null, 0.5)).not.toContain('data-from');
  });
});

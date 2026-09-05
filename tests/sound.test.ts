import { describe, expect, it } from 'vitest';
import { MAX_SOUND_SECONDS, SOUND_NAMES, scriptDuration, settlementSound, toneScript } from '../src/ui/sound';

describe('효과음 스크립트', () => {
  it('8종 모두 비어 있지 않고 0.6초 안에 끝난다', () => {
    expect(SOUND_NAMES).toHaveLength(8);
    for (const name of SOUND_NAMES) {
      const steps = toneScript(name);
      expect(steps.length).toBeGreaterThan(0);
      expect(scriptDuration(steps)).toBeLessThanOrEqual(MAX_SOUND_SECONDS);
      for (const step of steps) {
        expect(step.gain).toBeGreaterThan(0);
        expect(step.gain).toBeLessThanOrEqual(0.4);
        expect(step.dur).toBeGreaterThan(0);
      }
    }
  });

  it('상승은 올라가는 음, 하락은 내려가는 음, 주사위는 노이즈다', () => {
    const up = toneScript('up').map((step) => step.freq);
    const down = toneScript('down').map((step) => step.freq);
    expect(up).toEqual([...up].sort((a, b) => a - b));
    expect(down).toEqual([...down].sort((a, b) => b - a));
    expect(toneScript('dice').every((step) => step.wave === 'noise')).toBe(true);
  });

  it('정산 소리는 평가액 변화 방향을 따르고 변화가 없으면 없다', () => {
    expect(settlementSound(100, 110, false)).toBe('up');
    expect(settlementSound(100, 90, false)).toBe('down');
    expect(settlementSound(100, 90, true)).toBe('shock');
    expect(settlementSound(100, 110, true)).toBe('up');
    expect(settlementSound(100, 100, false)).toBeNull();
  });
});

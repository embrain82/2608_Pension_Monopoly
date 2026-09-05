export type SoundName = 'dice' | 'hop' | 'arrive' | 'news' | 'shock' | 'up' | 'down' | 'star';
export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';

export interface ToneStep {
  /** 시작 오프셋(초) */
  at: number;
  /** 주파수(Hz). noise는 무시 */
  freq: number;
  /** 길이(초) */
  dur: number;
  wave: Wave;
  /** 0~1 */
  gain: number;
}

export const SOUND_NAMES: SoundName[] = ['dice', 'hop', 'arrive', 'news', 'shock', 'up', 'down', 'star'];
export const MAX_SOUND_SECONDS = 0.6;

const step = (at: number, freq: number, dur: number, wave: Wave, gain: number): ToneStep => ({ at, freq, dur, wave, gain });

/** 음원 파일 없이 오실레이터로 만드는 8종. 모두 0.6초 이내로 끝난다. */
export function toneScript(name: SoundName): ToneStep[] {
  switch (name) {
    case 'dice':
      return [step(0, 0, 0.12, 'noise', 0.35), step(0.1, 0, 0.08, 'noise', 0.22), step(0.19, 0, 0.06, 'noise', 0.12)];
    case 'hop':
      return [step(0, 880, 0.04, 'square', 0.12)];
    case 'arrive':
      return [step(0, 1320, 0.16, 'triangle', 0.25)];
    case 'news':
      return [step(0, 660, 0.12, 'triangle', 0.25), step(0.14, 990, 0.2, 'triangle', 0.25)];
    case 'shock':
      return [step(0, 70, 0.45, 'sawtooth', 0.35), step(0, 0, 0.25, 'noise', 0.2)];
    case 'up':
      return [step(0, 523, 0.1, 'sine', 0.22), step(0.1, 659, 0.1, 'sine', 0.22), step(0.2, 784, 0.18, 'sine', 0.22)];
    case 'down':
      return [step(0, 440, 0.14, 'sine', 0.22), step(0.16, 294, 0.24, 'sine', 0.2)];
    case 'star':
      return [step(0, 784, 0.1, 'triangle', 0.25), step(0.1, 988, 0.1, 'triangle', 0.25), step(0.2, 1319, 0.24, 'triangle', 0.28)];
  }
}

export function scriptDuration(steps: ToneStep[]): number {
  return steps.reduce((max, item) => Math.max(max, item.at + item.dur), 0);
}

/** 정산 결과에 맞는 소리. 변화가 없으면 소리를 내지 않는다. */
export function settlementSound(irpBefore: number, irpAfter: number, shock: boolean): SoundName | null {
  if (shock && irpAfter < irpBefore) return 'shock';
  if (irpAfter > irpBefore) return 'up';
  if (irpAfter < irpBefore) return 'down';
  return null;
}

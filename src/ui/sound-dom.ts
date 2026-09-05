import { toneScript, type SoundName } from './sound';

/**
 * WebAudio 재생기. 첫 사용자 제스처에서 unlock()을 불러 AudioContext를 만든다.
 * enabled()가 false면 아무 것도 만들지 않으므로 소리 끔 상태에서는 오디오 권한을 건드리지 않는다.
 */
export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  constructor(private readonly enabled: () => boolean) {}

  unlock(): void {
    if (!this.enabled() || typeof AudioContext === 'undefined') return;
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(name: SoundName): void {
    if (!this.enabled()) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const step of toneScript(name)) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + step.at);
      gain.gain.exponentialRampToValueAtTime(step.gain, now + step.at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + step.at + step.dur);
      gain.connect(ctx.destination);
      if (step.wave === 'noise') {
        const source = ctx.createBufferSource();
        source.buffer = this.noiseBuffer(ctx);
        source.connect(gain);
        source.start(now + step.at);
        source.stop(now + step.at + step.dur);
      } else {
        const osc = ctx.createOscillator();
        osc.type = step.wave;
        osc.frequency.setValueAtTime(step.freq, now + step.at);
        osc.connect(gain);
        osc.start(now + step.at);
        osc.stop(now + step.at + step.dur);
      }
    }
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }
}

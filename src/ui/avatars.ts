import type { GameState, ProfileId } from '../types';

export type Mood = 'calm' | 'tense' | 'happy';
export type Speaker = 'anchor' | 'coach';

export const AVATAR_ANIMALS: Record<ProfileId, string> = {
  stable: '거북이',
  stableGrowth: '코알라',
  balanced: '여우',
  growth: '사슴',
  aggressive: '치타'
};

export const MOOD_LABELS: Record<Mood, string> = { calm: '평온', tense: '긴장', happy: '기쁨' };

const INK = '#183635';
const CREAM = '#fbfcf6';
const STROKE = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

/** 충격 턴이거나 이번 턴 IRP가 5% 이상 줄면 긴장, 목표를 넘기면 기쁨. */
export function avatarMood(state: GameState, goalMet: boolean): Mood {
  if (goalMet) return 'happy';
  if (state.turn > 0 && state.lastMarket.shock) return 'tense';
  const last = state.irpHistory.at(-1);
  const prev = state.irpHistory.at(-2);
  if (last !== undefined && prev !== undefined && prev > 0 && last / prev - 1 <= -0.05) return 'tense';
  return 'calm';
}

export function resultMood(stars: number): Mood {
  if (stars >= 2) return 'happy';
  if (stars === 0) return 'tense';
  return 'calm';
}

/** 눈·입·(긴장 시) 땀방울. 모든 캐릭터가 같은 얼굴 부품을 써 톤을 맞춘다. */
function face(mood: Mood, cx = 50, cy = 56, spread = 13, drop = 0): string {
  const l = cx - spread;
  const r = cx + spread;
  const eyes = mood === 'happy'
    ? `<path d="M${l - 5} ${cy}q5 -6 10 0M${r - 5} ${cy}q5 -6 10 0" fill="none" ${STROKE}/>`
    : `<circle cx="${l}" cy="${cy}" r="3.5" fill="${INK}"/><circle cx="${r}" cy="${cy}" r="3.5" fill="${INK}"/>`
      + (mood === 'tense' ? `<path d="M${l - 6} ${cy - 9}l12 3M${r + 6} ${cy - 9}l-12 3" fill="none" ${STROKE}/>` : '');
  const mouth = mood === 'happy'
    ? `<path d="M${cx - 9} ${cy + 12}q9 10 18 0z" fill="${INK}"/>`
    : mood === 'tense'
      ? `<path d="M${cx - 7} ${cy + 14}q3.5 -4 7 0t7 0" fill="none" ${STROKE}/>`
      : `<path d="M${cx - 7} ${cy + 12}q7 6 14 0" fill="none" ${STROKE}/>`;
  const sweat = mood === 'tense'
    ? `<path class="sweat" d="M${r + 20 + drop} ${cy - 6}q6 8 0 12q-6 -4 0 -12z" fill="#8fc6e8" ${STROKE}/>`
    : '';
  return eyes + mouth + sweat;
}

function turtle(mood: Mood): string {
  return `<ellipse cx="50" cy="78" rx="40" ry="18" fill="#3f8f5f" ${STROKE}/>
    <path d="M22 76q28 -22 56 0" fill="none" ${STROKE}/><path d="M36 72v-10M50 68v-12M64 72v-10" fill="none" ${STROKE}/>
    <circle cx="50" cy="48" r="26" fill="#a9d36a" ${STROKE}/>${face(mood, 50, 46, 11)}`;
}

function koala(mood: Mood): string {
  return `<circle cx="18" cy="38" r="15" fill="#9aa8a6" ${STROKE}/><circle cx="82" cy="38" r="15" fill="#9aa8a6" ${STROKE}/>
    <circle cx="18" cy="38" r="7" fill="#f3c9c1"/><circle cx="82" cy="38" r="7" fill="#f3c9c1"/>
    <circle cx="50" cy="54" r="30" fill="#b8c4c2" ${STROKE}/>${face(mood, 50, 48, 14)}
    <ellipse cx="50" cy="53" rx="6" ry="5" fill="${INK}"/>`;
}

function fox(mood: Mood): string {
  return `<path d="M18 22l14 24h-18zM82 22l-14 24h18z" fill="#e9893a" ${STROKE}/>
    <path d="M14 48q36 -26 72 0q0 44 -36 44q-36 0 -36 -44z" fill="#e9893a" ${STROKE}/>
    <path d="M32 66q18 -12 36 0q0 20 -18 20q-18 0 -18 -20z" fill="${CREAM}"/>${face(mood, 50, 52, 14)}
    <circle cx="50" cy="76" r="4" fill="${INK}"/>`;
}

function deer(mood: Mood): string {
  return `<path d="M26 34v-16m0 8l-10 -8m10 2l8 -10M74 34v-16m0 8l10 -8m-10 2l-8 -10" fill="none" ${STROKE}/>
    <path d="M14 40l14 6l-4 -14zM86 40l-14 6l4 -14z" fill="#d9a066" ${STROKE}/>
    <path d="M20 50q30 -24 60 0q4 40 -30 42q-34 -2 -30 -42z" fill="#d9a066" ${STROKE}/>
    <path d="M36 72q14 -8 28 0q0 16 -14 16q-14 0 -14 -16z" fill="${CREAM}"/>${face(mood, 50, 54, 13)}
    <ellipse cx="50" cy="80" rx="5" ry="4" fill="${INK}"/>`;
}

function cheetah(mood: Mood): string {
  return `<circle cx="20" cy="36" r="10" fill="#e8b84a" ${STROKE}/><circle cx="80" cy="36" r="10" fill="#e8b84a" ${STROKE}/>
    <circle cx="50" cy="56" r="30" fill="#e8b84a" ${STROKE}/>
    <circle cx="28" cy="40" r="3" fill="${INK}"/><circle cx="72" cy="40" r="3" fill="${INK}"/><circle cx="36" cy="30" r="2.5" fill="${INK}"/><circle cx="64" cy="30" r="2.5" fill="${INK}"/>
    <path d="M37 56q-2 8 -4 12M63 56q2 8 4 12" fill="none" ${STROKE}/>${face(mood, 50, 52, 13)}
    <ellipse cx="50" cy="70" rx="5" ry="3.5" fill="${INK}"/>`;
}

const BODIES: Record<ProfileId, (mood: Mood) => string> = { stable: turtle, stableGrowth: koala, balanced: fox, growth: deer, aggressive: cheetah };

/** 100×100 좌표계의 내부 도형. 보드처럼 다른 SVG 안에 중첩할 때 쓴다. */
export function avatarBody(profileId: ProfileId, mood: Mood): string {
  return BODIES[profileId](mood);
}

export function renderAvatar(profileId: ProfileId, mood: Mood, size = 64): string {
  return `<svg class="avatar avatar-${profileId} mood-${mood}" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${AVATAR_ANIMALS[profileId]} · ${MOOD_LABELS[mood]}">${avatarBody(profileId, mood)}</svg>`;
}

function owlBody(): string {
  return `<path d="M22 30l8 12M78 30l-8 12" fill="none" ${STROKE}/>
    <ellipse cx="50" cy="58" rx="32" ry="34" fill="#7a6a58" ${STROKE}/>
    <circle cx="36" cy="50" r="12" fill="${CREAM}" ${STROKE}/><circle cx="64" cy="50" r="12" fill="${CREAM}" ${STROKE}/>
    <circle cx="36" cy="50" r="5" fill="${INK}"/><circle cx="64" cy="50" r="5" fill="${INK}"/>
    <path d="M50 58l-5 8h10z" fill="#e9893a" ${STROKE}/>
    <rect x="70" y="66" width="8" height="22" rx="4" fill="#3d4f4c" ${STROKE}/><circle cx="74" cy="64" r="7" fill="#3d4f4c" ${STROKE}/>`;
}

function penguinBody(): string {
  return `<ellipse cx="50" cy="60" rx="30" ry="34" fill="${INK}" ${STROKE}/>
    <ellipse cx="50" cy="66" rx="20" ry="24" fill="${CREAM}"/>
    <path d="M28 20h44l-4 12h-36z" fill="#3f8f5f" ${STROKE}/><rect x="24" y="30" width="52" height="7" rx="3" fill="#3f8f5f" ${STROKE}/>
    <circle cx="41" cy="48" r="3.5" fill="${INK}"/><circle cx="59" cy="48" r="3.5" fill="${INK}"/>
    <path d="M44 56h12l-6 6z" fill="#e9893a" ${STROKE}/>
    <path d="M22 62q-8 12 2 22M78 62q8 12 -2 22" fill="none" ${STROKE}/>`;
}

export function renderSpeaker(speaker: Speaker, size = 56): string {
  const label = speaker === 'anchor' ? '앵커 부엉이' : '코치 펭귄';
  return `<svg class="avatar avatar-${speaker}" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${label}">${speaker === 'anchor' ? owlBody() : penguinBody()}</svg>`;
}

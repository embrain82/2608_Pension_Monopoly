import type { GameState } from '../types';

export function shouldShowHowTo(howtoSeen: boolean): boolean {
  return !howtoSeen;
}

export function shouldShowLearningTip(state: GameState, tipDismissed: boolean, waitingForDice: boolean): boolean {
  return !tipDismissed && state.turn >= 1 && !waitingForDice;
}

export function renderHowToModal(): string {
  return `<p class="eyebrow">처음 한 번만 보여 줍니다</p>
    <h2>한 턴은 이렇게 진행됩니다</h2>
    <ol class="howto-steps">
      <li><b>1</b><div><strong>주사위 굴리기</strong><p>나온 숫자만큼 말이 이동합니다.</p></div></li>
      <li><b>2</b><div><strong>시장·포트폴리오 확인</strong><p>이번 턴 수익률과 내 비중을 보고 상황을 읽습니다.</p></div></li>
      <li><b>3</b><div><strong>운용 지시 한 번</strong><p>납입·매매·리밸런싱 중 하나만 고르면 이번 턴이 정산됩니다.</p></div></li>
    </ol>
    <p>12턴 동안 목표 월 연금에 도전합니다. 이 안내는 설정에서 다시 볼 수 있습니다.</p>
    <button class="primary jumbo" data-action="dismiss-howto">알겠어요</button>`;
}

export function renderSettingsHowToButton(): string {
  return `<button class="secondary" data-action="open-howto">게임 방법 다시 보기</button>`;
}

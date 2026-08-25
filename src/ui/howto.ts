import type { GameState } from '../types';

export function shouldShowHowTo(howtoSeen: boolean): boolean {
  return !howtoSeen;
}

export function shouldShowLearningTip(state: GameState, tipDismissed: boolean, waitingForDice: boolean): boolean {
  return !tipDismissed && state.turn >= 1 && !waitingForDice;
}

export function buyNeedsContribution(irpCash: number): boolean {
  return irpCash < 100000;
}

export function renderHowToModal(): string {
  return `<p class="eyebrow">처음 한 번만 보여 줍니다</p>
    <h2>한 턴은 이렇게 진행됩니다</h2>
    <ol class="howto-steps">
      <li><b>1</b><div><strong>주사위 굴리기</strong><p>나온 숫자만큼 말이 이동합니다.</p></div></li>
      <li><b>2</b><div><strong>시장 확인</strong><p>이번 턴 수익률을 봅니다. 아직 잔고에는 안 들어갑니다.</p></div></li>
      <li><b>3</b><div><strong>먼저 납입, 그다음 매수</strong><p>시작할 때 대기자금은 0원입니다. 사려면 먼저 납입하세요. 주식 ETF는 적극투자형·공격투자형 진단 뒤에만 살 수 있습니다.</p></div></li>
      <li><b>4</b><div><strong>정산 한 번</strong><p>행동을 고르면 정산 요약이 열립니다. 한 턴에 운용은 한 번입니다.</p></div></li>
    </ol>
    <p>12턴 동안 목표 월 연금에 도전합니다. 오른쪽 위 성향 이름을 확인하고, 성향보다 높은 등급 상품은 살 수 없습니다. 이 안내는 설정에서 다시 볼 수 있습니다.</p>
    <button class="primary jumbo" data-action="dismiss-howto">알겠어요</button>`;
}

export function renderSettingsHowToButton(): string {
  return `<button class="secondary" data-action="open-howto">게임 방법 다시 보기</button>`;
}

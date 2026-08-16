import { boardTiles } from '../data/content';
import type { GameState, TileKind } from '../types';

const TILE_ICONS: Record<TileKind, string> = {
  start: '↻',
  product: '◆',
  market: '↗',
  life: '♥',
  trade: '⇄',
  rebalance: '◎',
  policy: '§',
  profile: '◐',
  outlook: '⌂'
};

export function boardPosition(index: number): { x: number; y: number } {
  if (index <= 6) return { x: index * 100, y: 0 };
  if (index <= 12) return { x: 600, y: (index - 6) * 100 };
  if (index <= 18) return { x: (18 - index) * 100, y: 600 };
  return { x: 0, y: (24 - index) * 100 };
}

export function tokenTileIndex(position: number): number {
  return Math.min(23, Math.max(0, position));
}

export function renderBoardMarkup(state: GameState, waiting: boolean): string {
  const token = tokenTileIndex(state.position);
  const tile = boardTiles[token];
  const tiles = boardTiles.map((item) => {
    const { x, y } = boardPosition(item.index);
    const active = item.index === token;
    const past = item.index < token;
    return `<g class="tile tile-${item.kind}${active ? ' active' : ''}${past ? ' past' : ''}" transform="translate(${x} ${y})">
        <rect x="3" y="3" width="94" height="94" rx="15"></rect>
        <text class="tile-icon" x="14" y="30">${TILE_ICONS[item.kind]}</text>
        <text class="tile-number" x="84" y="24" text-anchor="end">${String(item.index + 1).padStart(2, '0')}</text>
        <text class="tile-label" x="50" y="70" text-anchor="middle">${item.label.length > 7 ? item.label.slice(0, 7) : item.label}</text>
        ${active ? '<circle class="player" cx="50" cy="45" r="13"></circle><text class="player-mark" x="50" y="50" text-anchor="middle">나</text>' : ''}
      </g>`;
  }).join('');
  const center = waiting
    ? `<text x="350" y="286" text-anchor="middle">TURN ${String(Math.min(state.turn + 1, 12)).padStart(2, '0')} / 12</text>
      <text class="phase" x="350" y="338" text-anchor="middle">대기</text>
      <path d="M260 368H440"></path>
      <text x="350" y="410" text-anchor="middle">주사위를 굴려</text>
      <text x="350" y="438" text-anchor="middle">시장을 확인하세요</text>`
    : `<text x="350" y="286" text-anchor="middle">현재 시장 국면</text>
      <text class="phase" x="350" y="330" text-anchor="middle">${state.phase}</text>
      <path d="M260 368H440"></path>
      <text x="350" y="406" text-anchor="middle">${state.lastMarket.signal}</text>
      <text class="seed" x="350" y="445" text-anchor="middle">TURN ${String(state.turn).padStart(2, '0')} / 12 · ${tile.label}</text>`;
  return `<svg class="board" viewBox="0 0 700 700" role="img" aria-label="24칸 순환 보드. 현재 말은 ${token + 1}번 칸 ${tile.label}에 있습니다.">
      <rect class="board-bg" x="0" y="0" width="700" height="700" rx="28"></rect>${tiles}
      <g class="board-center">${center}</g>
    </svg>`;
}

import { NUMBER_TWEEN_MS, easeOutCubic, formatByKind, interpolate, type NumberKind } from './fx';

/** 렌더 뒤 `data-anim` 숫자를 시작 값에서 끝 값으로 트윈한다. 동작 줄이기면 즉시 끝 값. */
export function runNumberAnimations(root: ParentNode, skip: boolean): void {
  root.querySelectorAll<HTMLElement>('[data-anim][data-from]').forEach((node) => {
    const kind = node.dataset.anim as NumberKind;
    const from = Number(node.dataset.from);
    const to = Number(node.dataset.to);
    delete node.dataset.from;
    if (skip || !Number.isFinite(from) || !Number.isFinite(to)) {
      node.textContent = formatByKind(kind, to);
      return;
    }
    node.classList.add(to > from ? 'up' : 'down');
    const start = performance.now();
    const tick = (): void => {
      const t = easeOutCubic((performance.now() - start) / NUMBER_TWEEN_MS);
      node.textContent = formatByKind(kind, interpolate(from, to, t));
      if (t < 1) requestAnimationFrame(tick);
      else window.setTimeout(() => node.classList.remove('up', 'down'), 400);
    };
    requestAnimationFrame(tick);
  });
}

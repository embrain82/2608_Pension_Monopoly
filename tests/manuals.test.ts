import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('배포용 매뉴얼', () => {
  it('사용자·운영자 HTML이 주요 안내를 담는다', () => {
    const user = readFileSync('public/user-manual.html', 'utf8');
    const operator = readFileSync('public/operator-manual.html', 'utf8');
    expect(user).toContain('한 턴의 순서');
    expect(user).toContain('지금 구현된 것');
    expect(user).toContain('첫 판 따라하기');
    expect(user).toContain('케이스북');
    expect(user).toContain('안정형');
    expect(user).toContain('70%');
    expect(user).toContain('C18');
    expect(user).toContain('전액 거절');
    expect(user).toContain('한도까지만');
    expect(user).toContain('지금 판에 바로');
    expect(user).toContain('다음 판을 시작할 때');
    expect(user).toContain('모든 매수');
    expect(user).toContain('3별의 성향 정렬');
    expect(user).toContain('즉시 매도해 지급');
    expect(user).toContain('C19');
    expect(operator).toContain('구현된 기능');
    expect(operator).toContain('QA 케이스 매트릭스');
    expect(operator).toContain('vercel');
    expect(operator).toContain('pension-road.vercel.app');
    expect(operator).toContain('policy-rules.json');
    expect(operator).toContain('pages.yml');
    expect(operator).toContain('안전자산 매수도');
    expect(operator).toContain('Q17');
  });
});

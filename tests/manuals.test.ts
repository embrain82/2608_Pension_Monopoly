import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('배포용 매뉴얼', () => {
  it('사용자·운영자 HTML이 주요 안내를 담는다', () => {
    const user = readFileSync('public/user-manual.html', 'utf8');
    const operator = readFileSync('public/operator-manual.html', 'utf8');
    expect(user).toContain('한 턴의 순서');
    expect(user).toContain('케이스북');
    expect(user).toContain('안정형');
    expect(user).toContain('70%');
    expect(operator).toContain('QA 케이스 매트릭스');
    expect(operator).toContain('vercel');
    expect(operator).toContain('policy-rules.json');
  });
});

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

function context(method: string, cookies: Record<string, string> = {}, header?: string) {
  const request = { method, cookies, header: (name: string) => name === 'x-csrf-token' ? header : undefined };
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('CsrfGuard security', () => {
  const guard = new CsrfGuard();

  it('allows safe methods and unauthenticated mutations', () => {
    expect(guard.canActivate(context('GET', { access_token: 'access' }))).toBe(true);
    expect(guard.canActivate(context('POST'))).toBe(true);
  });

  it('accepts an exact double-submit token match', () => {
    expect(guard.canActivate(context('PATCH', { access_token: 'access', csrf_token: 'random-token' }, 'random-token'))).toBe(true);
  });

  it.each([
    ['missing header', undefined],
    ['wrong same-length token', 'tamper-token'],
    ['wrong-length token', 'short'],
  ])('rejects %s', (_case, header) => {
    expect(() => guard.canActivate(context('DELETE', { access_token: 'access', csrf_token: 'random-token' }, header))).toThrow(ForbiddenException);
  });
});

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database.service';
import { JwtAuthGuard } from './jwt-auth.guard';

function context(headers: Record<string, string> = {}, cookies: Record<string, string> = {}) {
  const request: { header: (name: string) => string | undefined; cookies: Record<string, string>; user?: unknown } = { header: (name) => headers[name], cookies };
  return { request, context: { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext };
}

describe('JwtAuthGuard authentication', () => {
  const config = { get: jest.fn((_key: string, fallback: string) => fallback) } as unknown as ConfigService;

  it('rejects requests without a bearer or access cookie', async () => {
    const guard = new JwtAuthGuard({} as JwtService, config, {} as DatabaseService);
    await expect(guard.canActivate(context().context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validates token type and active database session before attaching identity', async () => {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', sid: 'session-1', amr: ['pwd', 'mfa'], type: 'access' }) };
    const db = { session: { findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }) } };
    const guard = new JwtAuthGuard(jwt as unknown as JwtService, config, db as unknown as DatabaseService);
    const request = context({ authorization: 'Bearer signed-token' });

    await expect(guard.canActivate(request.context)).resolves.toBe(true);
    expect(request.request.user).toEqual({ id: 'user-1', sessionId: 'session-1', amr: ['pwd', 'mfa'] });
    expect(db.session.findFirst).toHaveBeenCalledWith({ where: { id: 'session-1', userId: 'user-1', revokedAt: null, expiresAt: { gt: expect.any(Date) } } });
  });

  it.each([
    [{ type: 'mfa_challenge', sub: 'user-1', sid: 'session-1' }, { id: 'session-1' }],
    [{ type: 'access', sub: 'user-1', sid: 'session-1' }, null],
  ])('rejects wrong token type or revoked/expired session', async (claims, session) => {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue(claims) };
    const db = { session: { findFirst: jest.fn().mockResolvedValue(session) } };
    const guard = new JwtAuthGuard(jwt as unknown as JwtService, config, db as unknown as DatabaseService);
    await expect(guard.canActivate(context({}, { access_token: 'token' }).context)).rejects.toThrow('Session expired or invalid');
  });
});

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database.service';
import { UserStatus } from '../prisma';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  __esModule: true,
  default: { hash: jest.fn().mockResolvedValue('hash'), verify: jest.fn() },
}));

type UserFixture = {
  id: string; email: string; firstName: string; lastName: string; passwordHash: string;
  status: UserStatus; lockedUntil: Date | null; failedLoginAttempts: number; mfaEnabled: boolean;
};
const user: UserFixture = {
  id: 'user-1', email: 'alex@example.com', firstName: 'Alex', lastName: 'Morgan', passwordHash: 'stored-hash',
  status: UserStatus.ACTIVE, lockedUntil: null, failedLoginAttempts: 0, mfaEnabled: false,
};

describe('AuthService authentication', () => {
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token'), verifyAsync: jest.fn() };
  const config = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => jest.clearAllMocks());

  function setup(found: typeof user | null = user) {
    const db = {
      user: { findUnique: jest.fn().mockResolvedValue(found), findUniqueOrThrow: jest.fn().mockResolvedValue(user), update: jest.fn().mockResolvedValue(user) },
      loginEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      device: { upsert: jest.fn().mockResolvedValue({ id: 'device-1' }) },
      session: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    return { db, service: new AuthService(db as unknown as DatabaseService, jwt as unknown as JwtService, config as unknown as ConfigService, audit as unknown as AuditService) };
  }

  it('normalizes email, records login, creates device/session, and returns public session data', async () => {
    const { db, service } = setup();
    jest.mocked(argon2.verify).mockResolvedValue(true);

    const result = await service.login({ email: '  ALEX@EXAMPLE.COM ', password: 'ValidPassword!1' }, { ipAddress: '203.0.113.8', userAgent: 'Browser' });

    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: 'alex@example.com' } });
    expect(db.device.upsert).toHaveBeenCalled();
    expect(db.session.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', deviceId: 'device-1' }) }));
    expect(result).toMatchObject({ mfaRequired: false, session: { accessToken: 'access-token', user: { id: 'user-1', email: 'alex@example.com' } } });
  });

  it('uses a generic error for an unknown user and records a failed event', async () => {
    const { db, service } = setup(null);
    await expect(service.login({ email: 'missing@example.com', password: 'not-secret' }, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.loginEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ successful: false, reason: 'unknown_user' }) });
  });

  it('locks an account on the fifth failed attempt without disclosing credential detail', async () => {
    const { db, service } = setup({ ...user, failedLoginAttempts: 4 });
    jest.mocked(argon2.verify).mockResolvedValue(false);

    await expect(service.login({ email: user.email, password: 'wrong' }, {})).rejects.toThrow('Email or password is incorrect');
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { failedLoginAttempts: 5, lockedUntil: expect.any(Date) } });
    expect(db.loginEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ suspicious: true, riskScore: 80 }) });
  });

  it('rejects a currently locked account before password verification', async () => {
    const { service } = setup({ ...user, lockedUntil: new Date(Date.now() + 60_000) });
    await expect(service.login({ email: user.email, password: 'password' }, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(argon2.verify).not.toHaveBeenCalled();
  });
});

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../database.service';
import { Role } from '../prisma';
import { RolesGuard } from './roles.guard';

function context(user?: { id: string }) {
  return { getHandler: () => function handler() {}, getClass: () => class Controller {}, switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext;
}

describe('RolesGuard authorization', () => {
  it('allows routes without role metadata', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new RolesGuard(reflector as unknown as Reflector, {} as DatabaseService);
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('denies role-protected routes without an authenticated user', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) };
    const guard = new RolesGuard(reflector as unknown as Reflector, {} as DatabaseService);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies customers and permits an assigned admin', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) };
    const db = { userRole: { findMany: jest.fn().mockResolvedValueOnce([{ role: Role.CUSTOMER }]).mockResolvedValueOnce([{ role: Role.ADMIN }]) } };
    const guard = new RolesGuard(reflector as unknown as Reflector, db as unknown as DatabaseService);
    await expect(guard.canActivate(context({ id: 'user-1' }))).rejects.toThrow('You do not have permission');
    await expect(guard.canActivate(context({ id: 'admin-1' }))).resolves.toBe(true);
  });

  it('allows SUPER_ADMIN regardless of the requested administrative role', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.OPERATIONS]) };
    const db = { userRole: { findMany: jest.fn().mockResolvedValue([{ role: Role.SUPER_ADMIN }]) } };
    const guard = new RolesGuard(reflector as unknown as Reflector, db as unknown as DatabaseService);
    await expect(guard.canActivate(context({ id: 'root' }))).resolves.toBe(true);
  });
});

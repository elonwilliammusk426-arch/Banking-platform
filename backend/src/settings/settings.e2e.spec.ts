import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest().user = { id: 'user-1', sessionId: 'session-1', amr: ['pwd'] };
    return true;
  }
}

describe('Settings API (HTTP integration/e2e)', () => {
  let app: INestApplication;
  const settings = {
    get: jest.fn().mockResolvedValue({ profile: { id: 'user-1' }, preference: {}, security: {}, accounts: [], devices: [] }),
    updatePreference: jest.fn().mockImplementation((_userId, dto) => dto),
    updateSecurity: jest.fn().mockImplementation((_userId, dto) => dto),
    updateAccount: jest.fn().mockImplementation((_userId, accountId, dto) => ({ accountId, ...dto })),
    devices: jest.fn().mockResolvedValue([]), setDeviceTrust: jest.fn().mockImplementation((_userId, id, dto) => ({ id, ...dto })),
    removeDevice: jest.fn().mockResolvedValue({ success: true }), revokeOtherSessions: jest.fn().mockResolvedValue({ success: true, revoked: 2 }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [SettingsController], providers: [{ provide: SettingsService, useValue: settings }] })
      .overrideGuard(JwtAuthGuard).useClass(TestAuthGuard).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('returns the authenticated user settings aggregate', async () => {
    await request(app.getHttpServer()).get('/settings').expect(200).expect(({ body }) => expect(body.profile.id).toBe('user-1'));
    expect(settings.get).toHaveBeenCalledWith('user-1', 'session-1');
  });

  it('validates and transforms preference updates', async () => {
    await request(app.getHttpServer()).patch('/settings/preferences').send({ language: 'fr', emailNotifications: false }).expect(200).expect({ language: 'fr', emailNotifications: false });
    expect(settings.updatePreference).toHaveBeenCalledWith('user-1', { language: 'fr', emailNotifications: false });
  });

  it('rejects unknown fields and invalid security timeout values', async () => {
    await request(app.getHttpServer()).patch('/settings/security').send({ sessionTimeoutMinutes: 2, isAdmin: true }).expect(400);
    expect(settings.updateSecurity).not.toHaveBeenCalled();
  });

  it('exposes trusted-device management and session revocation over HTTP', async () => {
    await request(app.getHttpServer()).patch('/settings/devices/device-1/trust').send({ trusted: true }).expect(200).expect({ id: 'device-1', trusted: true });
    await request(app.getHttpServer()).delete('/settings/devices/device-1').expect(200).expect({ success: true });
    await request(app.getHttpServer()).post('/settings/sessions/revoke-others').expect(201).expect({ success: true, revoked: 2 });
  });
});

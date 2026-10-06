import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database.service';
import { SettingsService } from './settings.service';

describe('SettingsService user settings', () => {
  const audit = { record: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('persists preferences and synchronizes legacy user locale fields', async () => {
    const preference = { id: 'pref-1', userId: 'user-1', language: 'fr', timezone: 'Europe/Paris' };
    const db = {
      userPreference: { upsert: jest.fn().mockResolvedValue(preference) },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = new SettingsService(db as unknown as DatabaseService, audit as unknown as AuditService);

    await expect(service.updatePreference('user-1', { language: 'fr', timezone: 'Europe/Paris' })).resolves.toBe(preference);
    expect(db.userPreference.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' }, update: { language: 'fr', timezone: 'Europe/Paris' } }));
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { preferredLanguage: 'fr', timezone: 'Europe/Paris' } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'settings.preference.updated', actorUserId: 'user-1' }));
  });

  it('cannot update account settings for another user account', async () => {
    const db = { account: { findFirst: jest.fn().mockResolvedValue(null) }, accountSetting: { upsert: jest.fn() } };
    const service = new SettingsService(db as unknown as DatabaseService, audit as unknown as AuditService);

    await expect(service.updateAccount('user-1', 'account-2', { transactionAlerts: false })).rejects.toBeInstanceOf(NotFoundException);
    expect(db.accountSetting.upsert).not.toHaveBeenCalled();
  });

  it('marks the selected owned device trusted and audits the change', async () => {
    const db = { device: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new SettingsService(db as unknown as DatabaseService, audit as unknown as AuditService);

    await expect(service.setDeviceTrust('user-1', 'device-1', { trusted: true })).resolves.toEqual({ id: 'device-1', trusted: true });
    expect(db.device.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'device-1', userId: 'user-1', revokedAt: null }, data: { trustedAt: expect.any(Date) } }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'security.device.trusted' }));
  });

  it('atomically revokes device sessions before marking a device removed', async () => {
    const operations: unknown[] = [];
    const db = {
      device: { findFirst: jest.fn().mockResolvedValue({ id: 'device-1' }), update: jest.fn().mockReturnValue({ op: 'device' }) },
      session: { updateMany: jest.fn().mockReturnValue({ op: 'sessions' }) },
      $transaction: jest.fn().mockImplementation(async (ops: unknown[]) => { operations.push(...ops); }),
    };
    const service = new SettingsService(db as unknown as DatabaseService, audit as unknown as AuditService);

    await expect(service.removeDevice('user-1', 'device-1')).resolves.toEqual({ success: true });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(operations).toEqual([{ op: 'sessions' }, { op: 'device' }]);
    expect(db.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', deviceId: 'device-1', revokedAt: null } }));
  });
});

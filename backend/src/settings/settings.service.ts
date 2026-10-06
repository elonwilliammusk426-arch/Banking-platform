import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { AuditService } from '../audit/audit.service';
import { SetDeviceTrustDto, UpdateAccountSettingDto, UpdateSecuritySettingDto, UpdateUserPreferenceDto } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService) {}

  async get(userId: string, sessionId: string) {
    const [profile, preference, security, accounts, devices] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, phone: true, firstName: true, lastName: true, mfaEnabled: true } }),
      this.db.userPreference.upsert({ where: { userId }, create: { userId }, update: {} }),
      this.db.securitySetting.upsert({ where: { userId }, create: { userId }, update: {} }),
      this.db.account.findMany({ where: { userId }, orderBy: { openedAt: 'asc' }, select: { id: true, name: true, accountNumberLast4: true, currency: true, setting: true } }),
      this.devices(userId, sessionId),
    ]);
    return { profile, preference, security, accounts, devices };
  }

  async updatePreference(userId: string, dto: UpdateUserPreferenceDto) {
    const preference = await this.db.userPreference.upsert({ where: { userId }, create: { userId, ...dto }, update: dto });
    // Keep the established User fields in sync for older consumers.
    const userData = { ...(dto.language ? { preferredLanguage: dto.language } : {}), ...(dto.timezone ? { timezone: dto.timezone } : {}) };
    if (Object.keys(userData).length) await this.db.user.update({ where: { id: userId }, data: userData });
    await this.audit.record({ actorUserId: userId, action: 'settings.preference.updated', entityType: 'user_preference', entityId: preference.id, metadata: { changedFields: Object.keys(dto) } });
    return preference;
  }

  async updateSecurity(userId: string, dto: UpdateSecuritySettingDto) {
    const setting = await this.db.securitySetting.upsert({ where: { userId }, create: { userId, ...dto }, update: dto });
    await this.audit.record({ actorUserId: userId, action: 'settings.security.updated', entityType: 'security_setting', entityId: setting.id, metadata: { changedFields: Object.keys(dto) } });
    return setting;
  }

  async updateAccount(userId: string, accountId: string, dto: UpdateAccountSettingDto) {
    const account = await this.db.account.findFirst({ where: { id: accountId, userId }, select: { id: true } });
    if (!account) throw new NotFoundException('Account not found');
    const setting = await this.db.accountSetting.upsert({ where: { accountId }, create: { accountId, ...dto }, update: dto });
    await this.audit.record({ actorUserId: userId, action: 'settings.account.updated', entityType: 'account_setting', entityId: setting.id, metadata: { accountId, changedFields: Object.keys(dto) } });
    return setting;
  }

  async devices(userId: string, sessionId: string) {
    const rows = await this.db.device.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, displayName: true, platform: true, browser: true, lastIpAddress: true, lastSeenAt: true, trustedAt: true, createdAt: true, sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, lastUsedAt: true } } },
    });
    return rows.map(({ sessions, ...device }) => ({ ...device, current: sessions.some((session) => session.id === sessionId), activeSessions: sessions.length }));
  }

  async setDeviceTrust(userId: string, deviceId: string, dto: SetDeviceTrustDto) {
    const result = await this.db.device.updateMany({ where: { id: deviceId, userId, revokedAt: null }, data: { trustedAt: dto.trusted ? new Date() : null } });
    if (!result.count) throw new NotFoundException('Device not found');
    await this.audit.record({ actorUserId: userId, action: dto.trusted ? 'security.device.trusted' : 'security.device.untrusted', entityType: 'device', entityId: deviceId });
    return { id: deviceId, trusted: dto.trusted };
  }

  async removeDevice(userId: string, deviceId: string) {
    const device = await this.db.device.findFirst({ where: { id: deviceId, userId, revokedAt: null }, select: { id: true } });
    if (!device) throw new NotFoundException('Device not found');
    const now = new Date();
    await this.db.$transaction([
      this.db.session.updateMany({ where: { userId, deviceId, revokedAt: null }, data: { revokedAt: now, revokeReason: 'customer_device_revoke' } }),
      this.db.device.update({ where: { id: deviceId }, data: { revokedAt: now, trustedAt: null } }),
    ]);
    await this.audit.record({ actorUserId: userId, action: 'security.device.removed', entityType: 'device', entityId: deviceId });
    return { success: true };
  }

  async revokeOtherSessions(userId: string, sessionId: string) {
    const result = await this.db.session.updateMany({ where: { userId, id: { not: sessionId }, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'customer_revoke_other_sessions' } });
    await this.audit.record({ actorUserId: userId, action: 'security.sessions.revoked_others', entityType: 'session', entityId: sessionId, metadata: { count: result.count } });
    return { success: true, revoked: result.count };
  }
}

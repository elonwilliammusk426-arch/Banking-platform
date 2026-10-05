import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { AuditService } from '../audit/audit.service';
import { UpdateProfileDto } from './customer.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService) {}

  profile(userId: string) {
    return this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, phone: true, firstName: true, lastName: true, status: true, emailVerifiedAt: true, phoneVerifiedAt: true, mfaEnabled: true, preferredLanguage: true, timezone: true, createdAt: true, kycProfile: { select: { status: true, level: true, riskLevel: true } } } });
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const current = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    const phoneChanged = dto.phone && dto.phone !== current.phone;
    const user = await this.db.user.update({ where: { id: userId }, data: { ...dto, ...(phoneChanged ? { phoneVerifiedAt: null } : {}) }, select: { id: true, email: true, phone: true, firstName: true, lastName: true, preferredLanguage: true, timezone: true, phoneVerifiedAt: true } });
    await this.audit.record({ actorUserId: userId, action: 'customer.profile.updated', entityType: 'user', entityId: userId, metadata: { changedFields: Object.keys(dto) } });
    return user;
  }

  sessions(userId: string) {
    return this.db.session.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: 'desc' }, select: { id: true, ipAddress: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true, device: { select: { id: true, displayName: true, platform: true, browser: true, trustedAt: true, lastSeenAt: true } } } });
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.db.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'customer_device_revoke' } });
    if (!result.count) throw new NotFoundException('Session not found');
    await this.audit.record({ actorUserId: userId, action: 'security.session.revoked', entityType: 'session', entityId: sessionId });
    return { success: true };
  }
}

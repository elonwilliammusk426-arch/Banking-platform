import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus, VerificationChannel } from '../prisma';
import argon2 from 'argon2';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database.service';
import { AuditService } from '../audit/audit.service';
import { MESSAGE_PROVIDER, MessageProvider } from '../integrations/provider.interfaces';
import { ConfirmVerificationDto, RequestVerificationDto } from './verification.dto';

@Injectable()
export class VerificationService {
  constructor(private readonly db: DatabaseService, private readonly config: ConfigService, private readonly audit: AuditService, @Inject(MESSAGE_PROVIDER) private readonly messages: MessageProvider) {}

  async request(dto: RequestVerificationDto) {
    const user = dto.userId ? await this.db.user.findUnique({ where: { id: dto.userId } }) : dto.email ? await this.db.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } }) : null;
    if (!user) return { challengeId: randomUUID(), expiresIn: 600 };
    const destination = dto.channel === VerificationChannel.EMAIL ? user.email : user.phone;
    if (!destination) throw new BadRequestException(`${dto.channel.toLowerCase()} is not configured`);
    const recent = await this.db.verificationCode.count({ where: { userId: user.id, channel: dto.channel, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (recent >= 3) throw new BadRequestException('Too many verification requests; try again later');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challenge = await this.db.verificationCode.create({ data: { userId: user.id, channel: dto.channel, destinationHash: createHash('sha256').update(destination).digest('hex'), codeHash: await argon2.hash(code), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    await this.messages.send({ channel: dto.channel, destination, template: 'verification_code', variables: { code } });
    return { challengeId: challenge.id, expiresIn: 600, ...(this.config.get('NODE_ENV') === 'development' ? { developmentCode: code } : {}) };
  }

  async confirm(dto: ConfirmVerificationDto) {
    const challenge = await this.db.verificationCode.findUnique({ where: { id: dto.challengeId }, include: { user: true } });
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5) throw new BadRequestException('Verification code expired or invalid');
    const valid = await argon2.verify(challenge.codeHash, dto.code);
    if (!valid) { await this.db.verificationCode.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } }); throw new BadRequestException('Verification code expired or invalid'); }
    const now = new Date();
    const emailVerifiedAt = challenge.channel === VerificationChannel.EMAIL ? now : challenge.user.emailVerifiedAt;
    const phoneVerifiedAt = challenge.channel === VerificationChannel.PHONE ? now : challenge.user.phoneVerifiedAt;
    await this.db.$transaction([
      this.db.verificationCode.update({ where: { id: challenge.id }, data: { consumedAt: now } }),
      this.db.user.update({ where: { id: challenge.userId }, data: { emailVerifiedAt, phoneVerifiedAt, status: emailVerifiedAt && phoneVerifiedAt ? UserStatus.ACTIVE : challenge.user.status } }),
    ]);
    await this.audit.record({ actorUserId: challenge.userId, action: `identity.${challenge.channel.toLowerCase()}_verified`, entityType: 'user', entityId: challenge.userId });
    return { verified: true, channel: challenge.channel, accountActive: Boolean(emailVerifiedAt && phoneVerifiedAt) };
  }
}

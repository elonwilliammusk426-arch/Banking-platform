import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditOutcome, Role, UserStatus } from '@haven/database';
import argon2 from 'argon2';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database.service';
import { AuditService } from '../audit/audit.service';
import { ConfirmMfaSetupDto, LoginDto, RegisterDto, VerifyMfaDto } from './auth.dto';
import { generateTotpSecret, verifyTotp } from './totp';

interface RequestMeta { ipAddress?: string; userAgent?: string; requestId?: string; }
interface SessionResult { accessToken: string; refreshToken: string; csrfToken: string; user: { id: string; email: string; firstName: string; lastName: string; mfaEnabled: boolean }; }

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
  private encryptionKey() {
    const configured = this.config.get('MFA_ENCRYPTION_KEY', 'development-mfa-encryption-key-change-me');
    const decoded = Buffer.from(configured, 'base64');
    return decoded.length === 32 ? decoded : createHash('sha256').update(configured).digest();
  }
  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return { encrypted: encrypted.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
  }
  private decrypt(encrypted: string, iv: string, tag: string) {
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
  }
  private equalHash(hash: string, value: string) {
    const a = Buffer.from(hash); const b = Buffer.from(this.hash(value));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async register(dto: RegisterDto, meta: RequestMeta) {
    const email = dto.email.trim().toLowerCase();
    if (await this.db.user.findFirst({ where: { OR: [{ email }, { phone: dto.phone }] } })) throw new BadRequestException('An account already exists for this email or phone number');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    const user = await this.db.user.create({ data: {
      email, firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), phone: dto.phone, passwordHash,
      status: UserStatus.PENDING_VERIFICATION,
      roles: { create: { role: Role.CUSTOMER } },
      kycProfile: { create: {} },
    }});
    await this.audit.record({ actorUserId: user.id, action: 'auth.register', entityType: 'user', entityId: user.id, ...meta });
    return { userId: user.id, verificationRequired: user.status === UserStatus.PENDING_VERIFICATION };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const emailHash = this.hash(normalizedEmail);
    const user = await this.db.user.findUnique({ where: { email: normalizedEmail } });
    const genericError = new UnauthorizedException('Email or password is incorrect');
    if (!user) { await argon2.hash(dto.password); await this.db.loginEvent.create({ data: { emailHash, successful: false, ipAddress: meta.ipAddress, userAgent: meta.userAgent, reason: 'unknown_user' } }); throw genericError; }
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new ForbiddenException('Account temporarily locked');
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      await this.db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts, lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null } });
      await this.db.loginEvent.create({ data: { userId: user.id, emailHash, successful: false, ipAddress: meta.ipAddress, userAgent: meta.userAgent, riskScore: attempts >= 5 ? 80 : 20, suspicious: attempts >= 5, reason: 'invalid_credentials' } });
      await this.audit.record({ actorUserId: user.id, action: 'auth.login', entityType: 'session', outcome: AuditOutcome.DENIED, metadata: { reason: 'invalid_credentials' }, ...meta });
      throw genericError;
    }
    if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException('Account is not active');
    const previousLogin = await this.db.loginEvent.findFirst({ where: { userId: user.id, successful: true }, orderBy: { createdAt: 'desc' } });
    const riskScore = (previousLogin?.ipAddress && previousLogin.ipAddress !== meta.ipAddress ? 35 : 0) + (previousLogin?.userAgent && previousLogin.userAgent !== meta.userAgent ? 25 : 0);
    const suspicious = riskScore >= 50;
    await this.db.$transaction([
      this.db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } }),
      this.db.loginEvent.create({ data: { userId: user.id, emailHash, successful: true, suspicious, riskScore, ipAddress: meta.ipAddress, userAgent: meta.userAgent, reason: suspicious ? 'new_ip_and_device' : null } }),
    ]);
    if (suspicious) await this.audit.record({ actorUserId: user.id, action: 'security.suspicious_login', entityType: 'user', entityId: user.id, metadata: { riskScore }, ...meta });
    if (user.mfaEnabled) {
      const challengeToken = await this.jwt.signAsync({ sub: user.id, type: 'mfa_challenge' }, { secret: this.config.get('JWT_MFA_SECRET', 'development-mfa-secret-change-me'), expiresIn: '5m' });
      return { mfaRequired: true as const, challengeToken };
    }
    return { mfaRequired: false as const, session: await this.issueSession(user.id, ['pwd'], meta) };
  }

  async verifyMfa(dto: VerifyMfaDto, meta: RequestMeta) {
    let claims: { sub: string; type: string };
    try { claims = await this.jwt.verifyAsync(dto.challengeToken, { secret: this.config.get('JWT_MFA_SECRET', 'development-mfa-secret-change-me') }); }
    catch { throw new UnauthorizedException('MFA challenge expired'); }
    if (claims.type !== 'mfa_challenge') throw new UnauthorizedException('Invalid MFA challenge');
    const user = await this.db.user.findUniqueOrThrow({ where: { id: claims.sub }, include: { recoveryCodes: { where: { usedAt: null } } } });
    let valid = false;
    if (user.mfaSecretEncrypted && user.mfaSecretIv && user.mfaSecretAuthTag && /^\d{6}$/.test(dto.code)) {
      valid = verifyTotp(this.decrypt(user.mfaSecretEncrypted, user.mfaSecretIv, user.mfaSecretAuthTag), dto.code);
    }
    if (!valid && dto.code.length > 6) {
      for (const recovery of user.recoveryCodes) {
        if (await argon2.verify(recovery.codeHash, dto.code.toUpperCase())) {
          await this.db.recoveryCode.update({ where: { id: recovery.id }, data: { usedAt: new Date() } }); valid = true; break;
        }
      }
    }
    if (!valid) {
      await this.audit.record({ actorUserId: user.id, action: 'auth.mfa.verify', entityType: 'session', outcome: AuditOutcome.DENIED, ...meta });
      throw new UnauthorizedException('Invalid authentication code');
    }
    return this.issueSession(user.id, ['pwd', 'mfa'], meta);
  }

  async setupMfa(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = generateTotpSecret(); const value = this.encrypt(secret);
    await this.db.user.update({ where: { id: userId }, data: { mfaSecretEncrypted: value.encrypted, mfaSecretIv: value.iv, mfaSecretAuthTag: value.tag, mfaEnabled: false } });
    return { secret, otpauthUri: `otpauth://totp/Haven:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Haven&algorithm=SHA1&digits=6&period=30` };
  }

  async confirmMfa(userId: string, dto: ConfirmMfaSetupDto, meta: RequestMeta) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecretEncrypted || !user.mfaSecretIv || !user.mfaSecretAuthTag) throw new BadRequestException('Start MFA setup first');
    const secret = this.decrypt(user.mfaSecretEncrypted, user.mfaSecretIv, user.mfaSecretAuthTag);
    if (!verifyTotp(secret, dto.code)) throw new BadRequestException('Invalid authentication code');
    const codes = Array.from({ length: 10 }, () => `${randomBytes(4).toString('hex').slice(0, 4)}-${randomBytes(4).toString('hex').slice(0, 4)}`.toUpperCase());
    const hashes = await Promise.all(codes.map((code) => argon2.hash(code, { type: argon2.argon2id })));
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { mfaEnabled: true } }),
      this.db.recoveryCode.deleteMany({ where: { userId } }),
      this.db.recoveryCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) }),
    ]);
    await this.audit.record({ actorUserId: userId, action: 'auth.mfa.enabled', entityType: 'user', entityId: userId, ...meta });
    return { recoveryCodes: codes };
  }

  private async issueSession(userId: string, amr: string[], meta: RequestMeta): Promise<SessionResult> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    const sessionId = randomUUID(); const familyId = randomUUID();
    const secret = randomBytes(48).toString('base64url'); const refreshToken = `${sessionId}.${secret}`;
    const csrfToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + Number(this.config.get('REFRESH_TOKEN_TTL_DAYS', 30)) * 86_400_000);
    const fingerprintHash = this.hash(`${meta.userAgent ?? 'unknown'}:${meta.ipAddress ?? 'unknown'}`);
    const device = await this.db.device.upsert({ where: { userId_fingerprintHash: { userId, fingerprintHash } }, create: { userId, fingerprintHash, displayName: this.deviceName(meta.userAgent), lastIpAddress: meta.ipAddress, browser: meta.userAgent?.slice(0, 160) }, update: { lastSeenAt: new Date(), lastIpAddress: meta.ipAddress } });
    await this.db.session.create({ data: { id: sessionId, userId, deviceId: device.id, familyId, refreshTokenHash: this.hash(refreshToken), csrfTokenHash: this.hash(csrfToken), expiresAt, ipAddress: meta.ipAddress, userAgent: meta.userAgent } });
    const accessToken = await this.signAccess(userId, sessionId, amr);
    await this.audit.record({ actorUserId: userId, action: 'auth.login', entityType: 'session', entityId: sessionId, ...meta, metadata: { amr } });
    return { accessToken, refreshToken, csrfToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, mfaEnabled: user.mfaEnabled } };
  }

  private deviceName(userAgent?: string) {
    if (!userAgent) return 'Unknown device';
    const platform = /iPhone|iPad/i.test(userAgent) ? 'iOS' : /Android/i.test(userAgent) ? 'Android' : /Mac/i.test(userAgent) ? 'Mac' : /Windows/i.test(userAgent) ? 'Windows' : 'Other';
    const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : /Firefox\//.test(userAgent) ? 'Firefox' : 'Browser';
    return `${browser} on ${platform}`;
  }

  private signAccess(userId: string, sessionId: string, amr: string[]) {
    return this.jwt.signAsync({ sub: userId, sid: sessionId, amr, type: 'access' }, { secret: this.config.get('JWT_ACCESS_SECRET', 'development-access-secret-change-me'), expiresIn: this.config.get('ACCESS_TOKEN_TTL', '10m') });
  }

  async refresh(refreshToken: string, csrfToken: string, meta: RequestMeta): Promise<SessionResult> {
    const [sessionId] = refreshToken.split('.');
    if (!sessionId || !refreshToken.includes('.')) throw new UnauthorizedException('Invalid refresh token');
    const session = await this.db.session.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('Session expired');
    if (!this.equalHash(session.refreshTokenHash, refreshToken)) {
      await this.db.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'refresh_token_reuse' } });
      await this.audit.record({ actorUserId: session.userId, action: 'auth.refresh.reuse_detected', entityType: 'session', entityId: session.id, outcome: AuditOutcome.DENIED, ...meta });
      throw new UnauthorizedException('Session revoked');
    }
    if (!csrfToken || !this.equalHash(session.csrfTokenHash, csrfToken)) throw new ForbiddenException('Invalid CSRF token');
    const nextSecret = randomBytes(48).toString('base64url'); const nextRefresh = `${session.id}.${nextSecret}`;
    const nextCsrf = randomBytes(32).toString('base64url');
    await this.db.session.update({ where: { id: session.id }, data: { refreshTokenHash: this.hash(nextRefresh), csrfTokenHash: this.hash(nextCsrf), rotationCounter: { increment: 1 }, lastUsedAt: new Date(), ipAddress: meta.ipAddress, userAgent: meta.userAgent } });
    return { accessToken: await this.signAccess(session.userId, session.id, session.user.mfaEnabled ? ['pwd', 'mfa'] : ['pwd']), refreshToken: nextRefresh, csrfToken: nextCsrf, user: { id: session.user.id, email: session.user.email, firstName: session.user.firstName, lastName: session.user.lastName, mfaEnabled: session.user.mfaEnabled } };
  }

  async logout(userId: string, sessionId: string, meta: RequestMeta) {
    await this.db.session.updateMany({ where: { id: sessionId, userId }, data: { revokedAt: new Date(), revokeReason: 'user_logout' } });
    await this.audit.record({ actorUserId: userId, action: 'auth.logout', entityType: 'session', entityId: sessionId, ...meta });
  }
}

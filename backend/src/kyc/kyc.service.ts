import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { KycStatus } from '../prisma';
import { DatabaseService } from '../database.service';
import { EncryptionService } from '../security/encryption.service';
import { AuditService } from '../audit/audit.service';
import { KYC_PROVIDER, KycProvider } from '../integrations/provider.interfaces';
import { AddKycDocumentDto, SaveKycProfileDto } from './kyc.dto';

@Injectable()
export class KycService {
  constructor(private readonly db: DatabaseService, private readonly encryption: EncryptionService, private readonly audit: AuditService, @Inject(KYC_PROVIDER) private readonly provider: KycProvider) {}

  get(userId: string) {
    return this.db.kycProfile.findUnique({ where: { userId }, select: { id: true, status: true, level: true, riskLevel: true, rejectionReason: true, submittedAt: true, reviewedAt: true, updatedAt: true, documents: { select: { id: true, documentType: true, countryCode: true, verifiedAt: true, createdAt: true } } } });
  }

  async save(userId: string, dto: SaveKycProfileDto) {
    const birthDate = new Date(dto.dateOfBirth); const adultDate = new Date(); adultDate.setUTCFullYear(adultDate.getUTCFullYear() - 18);
    if (birthDate > adultDate || birthDate < new Date('1900-01-01')) throw new BadRequestException('Customer must be at least 18 years old');
    const existing = await this.db.kycProfile.findUnique({ where: { userId } });
    if (existing && new Set<KycStatus>([KycStatus.SUBMITTED, KycStatus.IN_REVIEW, KycStatus.APPROVED]).has(existing.status)) throw new BadRequestException('KYC profile cannot be edited in its current state');
    const profile = await this.db.kycProfile.upsert({ where: { userId }, create: { userId, status: KycStatus.IN_PROGRESS, encryptedPayload: this.encryption.encryptJson(dto) }, update: { status: KycStatus.IN_PROGRESS, encryptedPayload: this.encryption.encryptJson(dto), rejectionReason: null } });
    await this.audit.record({ actorUserId: userId, action: 'kyc.profile.saved', entityType: 'kyc_profile', entityId: profile.id });
    return { id: profile.id, status: profile.status };
  }

  async addDocument(userId: string, dto: AddKycDocumentDto) {
    const profile = await this.db.kycProfile.findUniqueOrThrow({ where: { userId } });
    const file = await this.db.fileObject.findFirst({ where: { id: dto.fileObjectId, userId, purpose: 'identity_document', uploadedAt: { not: null } } });
    if (!file) throw new BadRequestException('Identity document upload not found');
    return this.db.kycDocument.create({ data: { kycProfileId: profile.id, fileObjectId: file.id, documentType: dto.documentType, countryCode: dto.countryCode.toUpperCase() } });
  }

  async submit(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { kycProfile: { include: { documents: true } } } });
    const profile = user.kycProfile;
    if (!user.emailVerifiedAt || !user.phoneVerifiedAt) throw new BadRequestException('Verify email and phone before submitting KYC');
    if (!profile?.encryptedPayload || !profile.documents.length) throw new BadRequestException('Complete your profile and upload an identity document');
    const provider = await this.provider.submit({ customerId: userId, encryptedPayload: profile.encryptedPayload, documentIds: profile.documents.map((item) => item.fileObjectId) });
    const updated = await this.db.kycProfile.update({ where: { id: profile.id }, data: { status: provider.status === 'APPROVED' ? KycStatus.APPROVED : KycStatus.IN_REVIEW, providerReference: provider.reference, submittedAt: new Date() } });
    await this.audit.record({ actorUserId: userId, action: 'kyc.submitted', entityType: 'kyc_profile', entityId: profile.id, metadata: { providerReference: provider.reference } });
    return { status: updated.status };
  }
}

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CardStatus, KycStatus } from '../prisma';
import { DatabaseService } from '../database.service';
import { AuditService } from '../audit/audit.service';
import { CARD_PROVIDER, CardProvider } from '../integrations/provider.interfaces';
import { ActivateCardDto, IssueCardDto, UpdateCardControlsDto } from './cards.dto';

@Injectable()
export class CardsService {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService, @Inject(CARD_PROVIDER) private readonly provider: CardProvider) {}
  list(userId: string) { return this.db.card.findMany({ where: { userId }, include: { controls: true, account: { select: { name: true, currency: true } } }, orderBy: { createdAt: 'desc' } }); }
  async issue(userId: string, dto: IssueCardDto) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { kycProfile: true } });
    if (user.kycProfile?.status !== KycStatus.APPROVED) throw new BadRequestException('KYC approval is required to issue a card');
    const account = await this.db.account.findFirst({ where: { id: dto.accountId, userId, status: 'ACTIVE' } }); if (!account) throw new NotFoundException('Account not found');
    const issued = await this.provider.issue({ customerId: userId, accountId: account.id, type: dto.type, name: `${user.firstName} ${user.lastName}` });
    const card = await this.db.card.create({ data: { userId, accountId: account.id, type: dto.type, status: CardStatus.PENDING_ACTIVATION, providerReference: issued.reference, last4: issued.last4, network: issued.network, expiryMonth: issued.expiryMonth, expiryYear: issued.expiryYear, cardholderName: `${user.firstName} ${user.lastName}`, controls: { create: {} }, events: { create: { action: 'issued', actorUserId: userId } } } });
    await this.audit.record({ actorUserId: userId, action: 'card.issued', entityType: 'card', entityId: card.id, metadata: { type: dto.type } }); return card;
  }
  async activate(userId: string, id: string, dto: ActivateCardDto) { const card = await this.owned(userId, id); if (card.last4 !== dto.last4) throw new BadRequestException('Card details do not match'); await this.provider.updateStatus(card.providerReference, 'activate'); return this.updateStatus(userId, card.id, CardStatus.ACTIVE, 'activated'); }
  async freeze(userId: string, id: string, frozen: boolean) { const card = await this.owned(userId, id); await this.provider.updateStatus(card.providerReference, frozen ? 'freeze' : 'unfreeze'); return this.updateStatus(userId, id, frozen ? CardStatus.FROZEN : CardStatus.ACTIVE, frozen ? 'frozen' : 'unfrozen'); }
  async controls(userId: string, id: string, dto: UpdateCardControlsDto) { await this.owned(userId, id); const controls = await this.db.cardControl.upsert({ where: { cardId: id }, create: { cardId: id, ...dto }, update: dto }); await this.db.cardEvent.create({ data: { cardId: id, action: 'controls_updated', actorUserId: userId, metadata: { changedFields: Object.keys(dto) } } }); return controls; }
  async transactions(userId: string, id: string) { await this.owned(userId, id); return this.db.cardTransaction.findMany({ where: { cardId: id }, orderBy: { authorizedAt: 'desc' }, take: 100 }); }
  async replace(userId: string, id: string) { const old = await this.owned(userId, id); await this.provider.updateStatus(old.providerReference, 'cancel'); const issued = await this.provider.issue({ customerId: userId, accountId: old.accountId, type: old.type, name: old.cardholderName }); return this.db.$transaction(async (tx) => { const card = await tx.card.create({ data: { userId, accountId: old.accountId, type: old.type, status: CardStatus.PENDING_ACTIVATION, providerReference: issued.reference, last4: issued.last4, network: issued.network, expiryMonth: issued.expiryMonth, expiryYear: issued.expiryYear, cardholderName: old.cardholderName, controls: { create: {} } } }); await tx.card.update({ where: { id: old.id }, data: { status: CardStatus.REPLACED, replacedById: card.id } }); await tx.cardEvent.createMany({ data: [{ cardId: old.id, action: 'replaced', actorUserId: userId }, { cardId: card.id, action: 'replacement_issued', actorUserId: userId }] }); return card; }); }
  private async owned(userId: string, id: string) { const card = await this.db.card.findFirst({ where: { id, userId } }); if (!card) throw new NotFoundException('Card not found'); return card; }
  private async updateStatus(userId: string, id: string, status: CardStatus, action: string) { const card = await this.db.card.update({ where: { id }, data: { status, activatedAt: status === CardStatus.ACTIVE ? new Date() : undefined, frozenAt: status === CardStatus.FROZEN ? new Date() : null } }); await this.db.cardEvent.create({ data: { cardId: id, action, actorUserId: userId } }); await this.audit.record({ actorUserId: userId, action: `card.${action}`, entityType: 'card', entityId: id }); return card; }
}

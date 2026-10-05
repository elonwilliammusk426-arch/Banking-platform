import { Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import type { BankRailProvider, CardProvider, KycProvider, MessageProvider } from './provider.interfaces';

@Injectable()
export class SandboxKycProvider implements KycProvider {
  async submit() { return { reference: `kyc_sandbox_${randomUUID()}`, status: 'IN_REVIEW' as const }; }
}
@Injectable()
export class SandboxCardProvider implements CardProvider {
  async issue() { const now = new Date(); return { reference: `card_sandbox_${randomUUID()}`, last4: String(randomInt(0, 10_000)).padStart(4, '0'), network: 'VISA', expiryMonth: now.getMonth() + 1, expiryYear: now.getFullYear() + 4 }; }
  async updateStatus() { return; }
}
@Injectable()
export class SandboxBankRailProvider implements BankRailProvider {
  async initiate() { return { reference: `rail_sandbox_${randomUUID()}`, status: 'PROCESSING' as const }; }
}
@Injectable()
export class SandboxMessageProvider implements MessageProvider {
  async send() { return { reference: `message_sandbox_${randomUUID()}` }; }
}

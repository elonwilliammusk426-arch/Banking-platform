import { Global, Module } from '@nestjs/common';
import { BANK_RAIL_PROVIDER, CARD_PROVIDER, KYC_PROVIDER, MESSAGE_PROVIDER } from './provider.interfaces';
import { SandboxBankRailProvider, SandboxCardProvider, SandboxKycProvider, SandboxMessageProvider } from './sandbox.providers';

@Global()
@Module({
  providers: [
    SandboxKycProvider, SandboxCardProvider, SandboxBankRailProvider, SandboxMessageProvider,
    { provide: KYC_PROVIDER, useExisting: SandboxKycProvider },
    { provide: CARD_PROVIDER, useExisting: SandboxCardProvider },
    { provide: BANK_RAIL_PROVIDER, useExisting: SandboxBankRailProvider },
    { provide: MESSAGE_PROVIDER, useExisting: SandboxMessageProvider },
  ],
  exports: [KYC_PROVIDER, CARD_PROVIDER, BANK_RAIL_PROVIDER, MESSAGE_PROVIDER],
})
export class IntegrationsModule {}

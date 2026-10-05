import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { RolesGuard } from './roles.guard';

@Global()
@Module({ providers: [EncryptionService, RolesGuard], exports: [EncryptionService, RolesGuard] })
export class SecurityModule {}

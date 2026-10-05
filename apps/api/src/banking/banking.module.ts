import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';

@Module({ imports: [AuthModule], controllers: [BankingController], providers: [BankingService], exports: [BankingService] })
export class BankingModule {}

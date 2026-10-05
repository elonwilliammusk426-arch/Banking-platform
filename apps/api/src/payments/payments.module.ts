import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BankingModule } from '../banking/banking.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ScheduledTransfersWorker } from './scheduled-transfers.worker';

@Module({ imports: [AuthModule, BankingModule], controllers: [PaymentsController], providers: [PaymentsService, ScheduledTransfersWorker], exports: [PaymentsService] })
export class PaymentsModule {}

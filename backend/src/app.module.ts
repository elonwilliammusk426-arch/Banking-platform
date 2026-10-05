import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment } from './env.validation';
import { DatabaseModule } from './database.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { CsrfGuard } from './common/guards/csrf.guard';
import { AuditModule } from './audit/audit.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { BankingModule } from './banking/banking.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { MetricsMiddleware } from './monitoring/metrics.middleware';
import { SecurityModule } from './security/security.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { VerificationModule } from './verification/verification.module';
import { CustomerModule } from './customer/customer.module';
import { KycModule } from './kyc/kyc.module';
import { AccountsModule } from './accounts/accounts.module';
import { PaymentsModule } from './payments/payments.module';
import { CardsModule } from './cards/cards.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SupportModule } from './support/support.module';
import { AdminModule } from './admin/admin.module';
import { LedgerModule } from './ledger/ledger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'], validate: validateEnvironment }),
    LoggerModule.forRoot({ pinoHttp: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', 'req.body.password', 'req.body.code', 'req.body.challengeToken'],
      autoLogging: { ignore: (req) => req.url === '/api/v1/health/live' },
      transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } } : undefined,
    }}),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    DatabaseModule, AuditModule, RedisModule, MonitoringModule, SecurityModule, IntegrationsModule, LedgerModule,
    AuthModule, VerificationModule, CustomerModule, KycModule, AccountsModule,
    BankingModule, PaymentsModule, CardsModule, NotificationsModule, SupportModule, AdminModule,
    StorageModule, HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware, MetricsMiddleware).forRoutes('*');
  }
}

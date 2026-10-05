import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupportModule } from '../support/support.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [AuthModule, SupportModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}

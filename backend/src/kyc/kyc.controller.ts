import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { AddKycDocumentDto, SaveKycProfileDto } from './kyc.dto';
import { KycService } from './kyc.service';

@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kyc: KycService) {}
  @Get() get(@CurrentUser() user: AuthenticatedUser) { return this.kyc.get(user.id); }
  @Put() save(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveKycProfileDto) { return this.kyc.save(user.id, dto); }
  @Post('documents') document(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddKycDocumentDto) { return this.kyc.addDocument(user.id, dto); }
  @Post('submit') submit(@CurrentUser() user: AuthenticatedUser) { return this.kyc.submit(user.id); }
}

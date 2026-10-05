import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfirmVerificationDto, RequestVerificationDto } from './verification.dto';
import { VerificationService } from './verification.service';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}
  @Post('request') @Throttle({ default: { limit: 6, ttl: 60_000 } }) request(@Body() dto: RequestVerificationDto) { return this.verification.request(dto); }
  @Post('confirm') @Throttle({ default: { limit: 10, ttl: 60_000 } }) confirm(@Body() dto: ConfirmVerificationDto) { return this.verification.confirm(dto); }
}

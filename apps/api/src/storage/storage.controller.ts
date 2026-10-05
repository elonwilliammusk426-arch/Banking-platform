import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateUploadDto } from './storage.dto';
import { StorageService } from './storage.service';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}
  @Post('upload-url')
  upload(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUploadDto) { return this.storage.createUpload(user.id, dto); }
  @Get(':id/download-url')
  download(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.storage.createDownload(user.id, id); }
  @Post(':id/complete')
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.storage.completeUpload(user.id, id); }
}

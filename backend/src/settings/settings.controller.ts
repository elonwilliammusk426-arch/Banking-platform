import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SetDeviceTrustDto, UpdateAccountSettingDto, UpdateSecuritySettingDto, UpdateUserPreferenceDto } from './settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) { return this.settings.get(user.id, user.sessionId); }

  @Patch('preferences')
  updatePreference(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserPreferenceDto) { return this.settings.updatePreference(user.id, dto); }

  @Patch('security')
  updateSecurity(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSecuritySettingDto) { return this.settings.updateSecurity(user.id, dto); }

  @Patch('accounts/:accountId')
  updateAccount(@CurrentUser() user: AuthenticatedUser, @Param('accountId') accountId: string, @Body() dto: UpdateAccountSettingDto) { return this.settings.updateAccount(user.id, accountId, dto); }

  @Get('devices')
  devices(@CurrentUser() user: AuthenticatedUser) { return this.settings.devices(user.id, user.sessionId); }

  @Patch('devices/:deviceId/trust')
  setDeviceTrust(@CurrentUser() user: AuthenticatedUser, @Param('deviceId') deviceId: string, @Body() dto: SetDeviceTrustDto) { return this.settings.setDeviceTrust(user.id, deviceId, dto); }

  @Delete('devices/:deviceId')
  removeDevice(@CurrentUser() user: AuthenticatedUser, @Param('deviceId') deviceId: string) { return this.settings.removeDevice(user.id, deviceId); }

  @Post('sessions/revoke-others')
  revokeOtherSessions(@CurrentUser() user: AuthenticatedUser) { return this.settings.revokeOtherSessions(user.id, user.sessionId); }
}

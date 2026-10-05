import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { ConfirmMfaSetupDto, LoginDto, RegisterDto, VerifyMfaDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface RequestWithContext extends Request { requestId?: string; }

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private meta(req: RequestWithContext) {
    return { ipAddress: req.ip, userAgent: req.header('user-agent'), requestId: req.requestId };
  }
  private setSessionCookies(res: Response, session: { accessToken: string; refreshToken: string; csrfToken: string }) {
    const secure = process.env.NODE_ENV === 'production';
    const domain = process.env.COOKIE_DOMAIN || undefined;
    res.cookie('access_token', session.accessToken, { httpOnly: true, secure, sameSite: 'lax', domain, path: '/', maxAge: 10 * 60_000 });
    res.cookie('refresh_token', session.refreshToken, { httpOnly: true, secure, sameSite: 'lax', domain, path: '/api/v1/auth', maxAge: 30 * 86_400_000 });
    res.cookie('csrf_token', session.csrfToken, { httpOnly: false, secure, sameSite: 'lax', domain, path: '/', maxAge: 30 * 86_400_000 });
    res.cookie('session_hint', 'active', { httpOnly: true, secure, sameSite: 'lax', domain, path: '/', maxAge: 30 * 86_400_000 });
  }
  private publicSession(session: { user: unknown; csrfToken: string }) { return { user: session.user, csrfToken: session.csrfToken }; }

  @Post('register') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto, @Req() req: RequestWithContext) { return this.auth.register(dto, this.meta(req)); }

  @Post('login') @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: RequestWithContext, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, this.meta(req));
    if (result.mfaRequired) return result;
    this.setSessionCookies(res, result.session);
    return { mfaRequired: false, ...this.publicSession(result.session) };
  }

  @Post('mfa/verify') @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async verifyMfa(@Body() dto: VerifyMfaDto, @Req() req: RequestWithContext, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.verifyMfa(dto, this.meta(req));
    this.setSessionCookies(res, session); return this.publicSession(session);
  }

  @Post('mfa/setup') @UseGuards(JwtAuthGuard)
  setupMfa(@CurrentUser() user: AuthenticatedUser) { return this.auth.setupMfa(user.id); }

  @Post('mfa/confirm') @UseGuards(JwtAuthGuard)
  confirmMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmMfaSetupDto, @Req() req: RequestWithContext) {
    return this.auth.confirmMfa(user.id, dto, this.meta(req));
  }

  @Post('refresh') @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(@Req() req: RequestWithContext, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.refresh(req.cookies?.refresh_token ?? '', req.header('x-csrf-token') ?? req.cookies?.csrf_token ?? '', this.meta(req));
    this.setSessionCookies(res, session); return this.publicSession(session);
  }

  @Post('logout') @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser, @Req() req: RequestWithContext, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.id, user.sessionId, this.meta(req));
    res.clearCookie('access_token', { path: '/' }); res.clearCookie('refresh_token', { path: '/api/v1/auth' }); res.clearCookie('csrf_token', { path: '/' }); res.clearCookie('session_hint', { path: '/' });
    return { success: true };
  }
}

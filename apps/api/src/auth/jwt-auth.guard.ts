import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { DatabaseService } from '../database.service';

interface AccessClaims { sub: string; sid: string; amr: string[]; type: string; }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService, private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const bearer = request.header('authorization')?.replace(/^Bearer\s+/i, '');
    const token = request.cookies?.access_token ?? bearer;
    if (!token) throw new UnauthorizedException('Authentication required');

    try {
      const payload = await this.jwt.verifyAsync<AccessClaims>(token, { secret: this.config.get('JWT_ACCESS_SECRET', 'development-access-secret-change-me') });
      if (payload.type !== 'access') throw new Error('Wrong token type');
      const session = await this.db.session.findFirst({ where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } } });
      if (!session) throw new Error('Session unavailable');
      Object.assign(request, { user: { id: payload.sub, sessionId: payload.sid, amr: payload.amr ?? ['pwd'] } });
      return true;
    } catch {
      throw new UnauthorizedException('Session expired or invalid');
    }
  }
}

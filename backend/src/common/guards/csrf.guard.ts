import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method) || !request.cookies?.access_token) return true;

    const cookie = String(request.cookies?.csrf_token ?? '');
    const header = String(request.header('x-csrf-token') ?? '');
    const cookieBuffer = Buffer.from(cookie);
    const headerBuffer = Buffer.from(header);
    if (!cookie || cookieBuffer.length !== headerBuffer.length || !timingSafeEqual(cookieBuffer, headerBuffer)) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}

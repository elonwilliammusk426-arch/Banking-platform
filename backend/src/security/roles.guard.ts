import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../prisma';
import { DatabaseService } from '../database.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    if (!request.user) throw new ForbiddenException('Role authorization requires a valid session');
    const assigned = await this.db.userRole.findMany({ where: { userId: request.user.id }, select: { role: true } });
    const roles = new Set(assigned.map((item) => item.role));
    if (roles.has(Role.SUPER_ADMIN) || required.some((role) => roles.has(role))) return true;
    throw new ForbiddenException('You do not have permission to perform this action');
  }
}

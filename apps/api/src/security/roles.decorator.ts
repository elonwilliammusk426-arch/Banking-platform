import { SetMetadata } from '@nestjs/common';
import { Role } from '@haven/database';

export const ROLES_KEY = 'required_roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

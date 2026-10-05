import { Injectable } from '@nestjs/common';
import { AuditOutcome, Prisma } from '@haven/database';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database.service';

export interface AuditEvent {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  outcome?: AuditOutcome;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async record(event: AuditEvent) {
    return this.db.$transaction(async (tx) => {
      // Serializes appends so each record cryptographically links to exactly one predecessor.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('haven_audit_chain'))`;
      const previous = await tx.auditLog.findFirst({ orderBy: { sequence: 'desc' }, select: { hash: true } });
      const createdAt = new Date();
      const canonical = JSON.stringify({
        actorUserId: event.actorUserId ?? null, action: event.action,
        entityType: event.entityType, entityId: event.entityId ?? null,
        outcome: event.outcome ?? AuditOutcome.SUCCESS, requestId: event.requestId ?? null,
        ipAddress: event.ipAddress ?? null, metadata: event.metadata ?? null,
        createdAt: createdAt.toISOString(), previousHash: previous?.hash ?? null,
      });
      const hash = createHash('sha256').update(`${previous?.hash ?? 'GENESIS'}:${canonical}`).digest('hex');
      return tx.auditLog.create({ data: {
        actorUserId: event.actorUserId, action: event.action, entityType: event.entityType,
        entityId: event.entityId, outcome: event.outcome, requestId: event.requestId,
        ipAddress: event.ipAddress, userAgent: event.userAgent,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
        previousHash: previous?.hash, hash, createdAt,
      }});
    });
  }
}

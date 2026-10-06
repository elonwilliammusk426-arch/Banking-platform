import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { DatabaseService } from './database.service';
import { UserStatus } from './prisma';

const describeWithDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

describeWithDatabase('PostgreSQL integration and API end-to-end', () => {
  let app: INestApplication;
  let db: DatabaseService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `e2e-${suffix}@example.com`;
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), JwtModule.register({})],
      controllers: [AuthController],
      providers: [DatabaseService, AuditService, AuthService, JwtAuthGuard],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    db = app.get(DatabaseService);
  });

  // CI uses an ephemeral PostgreSQL service. Do not delete the registered user:
  // its audit record is intentionally append-only and the database forbids mutation.
  afterAll(async () => app.close());

  it('registers a user through the real HTTP, service, Prisma, and PostgreSQL stack', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email, phone, firstName: 'Integration', lastName: 'User', password: 'StrongPassword!123',
    }).expect(201);

    expect(response.body).toMatchObject({ verificationRequired: true });
    const persisted = await db.user.findUnique({ where: { email }, include: { roles: true, kycProfile: true } });
    expect(persisted).toMatchObject({ email, status: UserStatus.PENDING_VERIFICATION, firstName: 'Integration' });
    expect(persisted?.roles).toHaveLength(1);
    expect(persisted?.kycProfile).not.toBeNull();
  });

  it('returns a validation error and does not persist malformed API input', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: `invalid-${email}`, phone: 'not-e164', firstName: 'X', lastName: 'User', password: 'weak', unexpected: true,
    }).expect(400);
    expect(await db.user.findUnique({ where: { email: `invalid-${email}` } })).toBeNull();
  });

  it('rolls back every database write when a transaction callback fails', async () => {
    const rollbackEmail = `rollback-${email}`;
    await expect(db.$transaction(async (tx) => {
      await tx.user.create({ data: { email: rollbackEmail, firstName: 'Rollback', lastName: 'Test', passwordHash: 'not-a-real-hash', status: UserStatus.ACTIVE } });
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');

    expect(await db.user.findUnique({ where: { email: rollbackEmail } })).toBeNull();
  });
});

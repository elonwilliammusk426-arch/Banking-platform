import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  constructor(config: ConfigService) {
    const configured = config.get('DATA_ENCRYPTION_KEY') ?? config.get('MFA_ENCRYPTION_KEY', 'development-data-encryption-key-change-me');
    const decoded = Buffer.from(configured, 'base64');
    this.key = decoded.length === 32 ? decoded : createHash('sha256').update(configured).digest();
  }

  encryptJson(value: unknown) {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((item) => item.toString('base64url')).join('.');
  }

  decryptJson<T>(value: string): T {
    const [iv, tag, encrypted] = value.split('.');
    if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted payload');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')) as T;
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { DatabaseService } from '../database.service';
import { CreateUploadDto } from './storage.dto';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  constructor(private readonly config: ConfigService, private readonly db: DatabaseService) {
    this.bucket = config.get('S3_BUCKET', 'haven-private');
    this.client = new S3Client({
      endpoint: config.get('S3_ENDPOINT'), region: config.get('S3_REGION', 'us-east-1'),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', 'false') === 'true',
      credentials: config.get('S3_ACCESS_KEY') ? { accessKeyId: config.getOrThrow('S3_ACCESS_KEY'), secretAccessKey: config.getOrThrow('S3_SECRET_KEY') } : undefined,
    });
  }

  async createUpload(userId: string, dto: CreateUploadDto) {
    const extension = extname(dto.fileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
    const objectKey = `users/${userId}/${dto.purpose}/${randomUUID()}${extension}`;
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, ContentType: dto.contentType, ContentLength: dto.sizeBytes, Metadata: { userId, purpose: dto.purpose } });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    const file = await this.db.fileObject.create({ data: { userId, objectKey, bucket: this.bucket, contentType: dto.contentType, sizeBytes: dto.sizeBytes, purpose: dto.purpose } });
    return { fileId: file.id, uploadUrl, objectKey, expiresIn: 300 };
  }

  async createDownload(userId: string, fileId: string) {
    const file = await this.db.fileObject.findFirstOrThrow({ where: { id: fileId, userId, uploadedAt: { not: null } } });
    const downloadUrl = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: file.bucket, Key: file.objectKey }), { expiresIn: 300 });
    return { downloadUrl, expiresIn: 300 };
  }

  async completeUpload(userId: string, fileId: string) {
    const file = await this.db.fileObject.findFirstOrThrow({ where: { id: fileId, userId } });
    const object = await this.client.send(new HeadObjectCommand({ Bucket: file.bucket, Key: file.objectKey }));
    if (!object.ContentLength || object.ContentLength > 10_000_000 || object.ContentType !== file.contentType) throw new BadRequestException('Uploaded object does not match the signed request');
    const updated = await this.db.fileObject.update({ where: { id: file.id }, data: { uploadedAt: new Date(), sizeBytes: object.ContentLength, checksum: object.ChecksumSHA256 ?? object.ETag?.replaceAll('"', '') } });
    return { fileId: updated.id, uploaded: true };
  }
}

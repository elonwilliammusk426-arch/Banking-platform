import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUploadDto {
  @IsString() @MaxLength(100) fileName: string;
  @IsIn(['image/jpeg', 'image/png', 'application/pdf']) contentType: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000) sizeBytes: number;
  @IsIn(['avatar', 'identity_document', 'statement']) purpose: string;
}

import { IsDateString, IsIn, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class SaveKycProfileDto {
  @IsDateString() dateOfBirth: string;
  @IsString() @Length(2, 2) nationality: string;
  @IsString() @Length(2, 2) residenceCountry: string;
  @IsString() @MaxLength(120) addressLine1: string;
  @IsString() @MaxLength(80) city: string;
  @IsString() @MaxLength(20) postalCode: string;
  @IsString() @MaxLength(40) occupation: string;
  @IsString() @MaxLength(80) sourceOfFunds: string;
  @IsString() @MaxLength(40) taxIdentifier: string;
}
export class AddKycDocumentDto {
  @IsUUID() fileObjectId: string;
  @IsIn(['passport', 'drivers_license', 'national_id', 'proof_of_address']) documentType: string;
  @IsString() @Length(2, 2) countryCode: string;
}

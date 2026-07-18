import { IsString, Matches } from 'class-validator';

export class RestoreBackupDto {
  @IsString()
  @Matches(/^open-logistirio-\d{8}-\d{6}(?:-pre-restore)?\.sql$/)
  fileName!: string;
}

import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class MatchMyDataSnapshotDto {
  @IsString()
  documentId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export enum ReviewMyDataSnapshotActionDto {
  IGNORE = 'IGNORE',
  REOPEN = 'REOPEN',
}

export class ReviewMyDataSnapshotDto {
  @IsEnum(ReviewMyDataSnapshotActionDto)
  action!: ReviewMyDataSnapshotActionDto;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

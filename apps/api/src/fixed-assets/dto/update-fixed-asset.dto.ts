import { PartialType } from '@nestjs/swagger';
import { CreateFixedAssetDto } from './create-fixed-asset.dto';

export class UpdateFixedAssetDto extends PartialType(CreateFixedAssetDto) {}

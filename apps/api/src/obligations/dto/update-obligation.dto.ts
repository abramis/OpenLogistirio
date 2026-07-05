import { PartialType } from '@nestjs/swagger';
import { CreateObligationDto } from './create-obligation.dto';

export class UpdateObligationDto extends PartialType(CreateObligationDto) {}

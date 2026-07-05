import { PartialType } from '@nestjs/swagger';
import { CreateCounterpartyDto } from './create-counterparty.dto';

export class UpdateCounterpartyDto extends PartialType(CreateCounterpartyDto) {}

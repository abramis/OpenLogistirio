import { Injectable } from '@nestjs/common';

@Injectable()
export class VatNumberValidatorService {
  isValidGreekVatNumber(value: string): boolean {
    return /^\d{9}$/.test(value);
  }
}

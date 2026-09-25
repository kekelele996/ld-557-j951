import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateHoldingDto {
  @ApiProperty({ example: 12, required: false, description: '止损比例（%）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stopLossPercent?: number;

  @ApiProperty({ example: 6, required: false, description: '止盈比例（%）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  takeProfitPercent?: number;
}

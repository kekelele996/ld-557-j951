import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateHoldingDto {
  @ApiPropertyOptional({ example: 0.1, description: '止损比例，如 0.1 表示下跌 10%' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stopLossPercent?: number;

  @ApiPropertyOptional({ example: 0.08, description: '止盈比例，如 0.08 表示上涨 8%' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  takeProfitPercent?: number;
}

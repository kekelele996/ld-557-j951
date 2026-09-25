import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateHoldingDto {
  @ApiProperty({ example: 'AAPL' })
  @IsString()
  symbol: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.000001)
  quantity: number;

  @ApiProperty({ example: 185.3 })
  @IsNumber()
  @Min(0)
  avgCost: number;

  @ApiPropertyOptional({ example: 0.1, description: '止损比例，默认 0.1（下跌 10%）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stopLossPercent?: number;

  @ApiPropertyOptional({ example: 0.08, description: '止盈比例，默认 0.08（上涨 8%）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  takeProfitPercent?: number;
}

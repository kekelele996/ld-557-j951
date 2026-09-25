import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({ example: 10, required: false, description: '止损比例（%），缺省 10' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stopLossPercent?: number;

  @ApiProperty({ example: 8, required: false, description: '止盈比例（%），缺省 8' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  takeProfitPercent?: number;
}

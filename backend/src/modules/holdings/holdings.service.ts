import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { CurrentUser } from '../../types/request';
import { AlertType } from '../../constants/enums';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';
import { MarketService } from '../market/market.service';
import { PortfoliosService } from '../portfolios/portfolios.service';

export const DEFAULT_STOP_LOSS_PERCENT = 10;
export const DEFAULT_TAKE_PROFIT_PERCENT = 8;

export interface HoldingRecord {
  id: number;
  portfolioId: number;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  pnl: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  returnPercent?: number;
  alertType?: AlertType | null;
}

export interface HoldingAlert {
  holdingId: number;
  symbol: string;
  returnPercent: number;
  alertType: AlertType;
  triggerPercent: number;
}

@Injectable()
export class HoldingsService {
  private readonly holdings: HoldingRecord[] = [
    {
      id: 1,
      portfolioId: 1,
      symbol: 'AAPL',
      quantity: 10,
      avgCost: 180,
      currentPrice: 195.2,
      pnl: 152,
      stopLossPercent: DEFAULT_STOP_LOSS_PERCENT,
      takeProfitPercent: DEFAULT_TAKE_PROFIT_PERCENT,
    },
  ];
  private nextId = 2;

  constructor(
    private readonly marketService: MarketService,
    @Inject(forwardRef(() => PortfoliosService))
    private readonly portfoliosService: PortfoliosService,
  ) {}

  listByPortfolio(portfolioId: number, user: CurrentUser) {
    this.portfoliosService.findOwned(portfolioId, user);
    return this.revalueAll(this.holdings.filter((item) => item.portfolioId === portfolioId));
  }

  alertsByPortfolio(portfolioId: number, user: CurrentUser): HoldingAlert[] {
    this.portfoliosService.findOwned(portfolioId, user);
    return this.buildAlerts(this.revalueAll(this.holdings.filter((item) => item.portfolioId === portfolioId)));
  }

  findOwned(id: number, user: CurrentUser) {
    const holding = this.holdings.find((item) => item.id === id);
    if (!holding) throw new NotFoundException('holding not found');
    this.portfoliosService.findOwned(holding.portfolioId, user);
    return this.revalue(holding);
  }

  create(portfolioId: number, dto: CreateHoldingDto, user: CurrentUser) {
    this.portfoliosService.findOwned(portfolioId, user);
    const currentPrice = this.marketService.currentPrice(dto.symbol);
    const holding: HoldingRecord = {
      id: this.nextId++,
      portfolioId,
      symbol: dto.symbol.toUpperCase(),
      quantity: dto.quantity,
      avgCost: dto.avgCost,
      currentPrice,
      pnl: (currentPrice - dto.avgCost) * dto.quantity,
      stopLossPercent: dto.stopLossPercent ?? DEFAULT_STOP_LOSS_PERCENT,
      takeProfitPercent: dto.takeProfitPercent ?? DEFAULT_TAKE_PROFIT_PERCENT,
    };
    this.holdings.push(holding);
    this.recomputePortfolioValue(portfolioId);
    return this.revalue(holding);
  }

  update(id: number, dto: UpdateHoldingDto, user: CurrentUser) {
    const holding = this.findOwned(id, user);
    if (dto.stopLossPercent !== undefined) holding.stopLossPercent = dto.stopLossPercent;
    if (dto.takeProfitPercent !== undefined) holding.takeProfitPercent = dto.takeProfitPercent;
    return this.revalue(holding);
  }

  delete(id: number, user: CurrentUser) {
    const holding = this.findOwned(id, user);
    const index = this.holdings.findIndex((item) => item.id === id);
    this.holdings.splice(index, 1);
    this.recomputePortfolioValue(holding.portfolioId);
    return { deleted: true, id };
  }

  applyTransaction(holdingId: number, quantity: number, price: number, type: 'BUY' | 'SELL' | 'DIVIDEND', user: CurrentUser) {
    const holding = this.findOwned(holdingId, user);
    if (type === 'BUY') {
      const newQuantity = holding.quantity + quantity;
      holding.avgCost = ((holding.avgCost * holding.quantity) + (price * quantity)) / newQuantity;
      holding.quantity = newQuantity;
    }
    if (type === 'SELL') {
      holding.quantity = Math.max(0, holding.quantity - quantity);
    }
    this.revalue(holding);
    this.recomputePortfolioValue(holding.portfolioId);
    return holding;
  }

  private revalueAll(items: HoldingRecord[]) {
    return items.map((item) => this.revalue(item));
  }

  private revalue(holding: HoldingRecord) {
    holding.currentPrice = this.marketService.currentPrice(holding.symbol);
    holding.pnl = Number(((holding.currentPrice - holding.avgCost) * holding.quantity).toFixed(2));
    holding.returnPercent = this.calcReturnPercent(holding);
    const alert = this.evaluateAlert(holding);
    holding.alertType = alert ? alert.alertType : null;
    return holding;
  }

  private calcReturnPercent(holding: HoldingRecord) {
    if (holding.avgCost <= 0) return 0;
    return Number((((holding.currentPrice - holding.avgCost) / holding.avgCost) * 100).toFixed(4));
  }

  private evaluateAlert(holding: HoldingRecord): HoldingAlert | null {
    if (holding.quantity <= 0) return null;
    const returnPercent = this.calcReturnPercent(holding);
    if (returnPercent >= holding.takeProfitPercent) {
      return {
        holdingId: holding.id,
        symbol: holding.symbol,
        returnPercent,
        alertType: AlertType.TAKE_PROFIT,
        triggerPercent: Number((returnPercent - holding.takeProfitPercent).toFixed(4)),
      };
    }
    if (returnPercent <= -holding.stopLossPercent) {
      return {
        holdingId: holding.id,
        symbol: holding.symbol,
        returnPercent,
        alertType: AlertType.STOP_LOSS,
        triggerPercent: Number((-holding.stopLossPercent - returnPercent).toFixed(4)),
      };
    }
    return null;
  }

  private buildAlerts(items: HoldingRecord[]): HoldingAlert[] {
    return items
      .map((item) => this.evaluateAlert(item))
      .filter((alert): alert is HoldingAlert => alert !== null)
      .sort((a, b) => b.triggerPercent - a.triggerPercent || a.holdingId - b.holdingId);
  }

  private recomputePortfolioValue(portfolioId: number) {
    const total = this.revalueAll(this.holdings.filter((item) => item.portfolioId === portfolioId))
      .reduce((sum, item) => sum + item.currentPrice * item.quantity, 0);
    this.portfoliosService.setTotalValue(portfolioId, total);
  }
}

# FinanceAPI 金融投资分析平台 API

```bash
docker compose up -d
```

本地开发：

```bash
cd backend
npm install
npm run start:dev
```

访问地址：
- API 健康检查：http://localhost:38505/api/health
- Swagger 文档：http://localhost:38505/api/docs

FinanceAPI 是面向个人投资者的纯后端 API 服务，覆盖投资组合、持仓、交易记录、市场行情与复盘日志。项目采用 NestJS + TypeORM 分层结构，保留 PostgreSQL/Redis/JWT/Docker Compose 部署配置，并提供可直接烟测的内存数据实现。

## 技术栈

| 分类 | 技术 |
|---|---|
| 框架 | NestJS |
| ORM | TypeORM |
| 数据库 | PostgreSQL 15 |
| 缓存 | Redis，行情 TTL 60 秒，历史数据 5 分钟，搜索 10 分钟 |
| 认证 | JWT + Passport |
| 校验 | class-validator + class-transformer |
| 文档 | Swagger `/api/docs` |
| 限流 | @nestjs/throttler |

## API 概览

| 模块 | 方法 | 路径 | 说明 |
|---|---|---|---|
| Auth | POST | `/api/auth/register` | 注册并返回 JWT |
| Auth | POST | `/api/auth/login` | 登录 |
| Auth | POST | `/api/auth/refresh` | 刷新 token |
| Auth | GET | `/api/auth/profile` | 当前用户 |
| Portfolio | GET/POST | `/api/portfolios` | 列表、创建 |
| Portfolio | GET/PUT/DELETE | `/api/portfolios/:id` | 详情、编辑、删除 |
| Portfolio | GET | `/api/portfolios/:id/performance` | 收益统计 |
| Holding | GET/POST | `/api/portfolios/:portfolioId/holdings` | 组合持仓 |
| Holding | GET/PATCH/DELETE | `/api/holdings/:id` | 持仓详情、调阈值、删除 |
| Transaction | GET/POST | `/api/holdings/:holdingId/transactions` | 持仓交易 |
| Transaction | GET | `/api/portfolios/:portfolioId/transactions` | 组合交易分页 |
| Market | GET | `/api/market/quote/:symbol` | 单资产行情 |
| Market | GET | `/api/market/search?q=` | 搜索资产 |
| Market | GET | `/api/market/history/:symbol` | 历史 K 线 |
| Market | GET | `/api/market/trending` | 热门资产 |
| Review | GET/POST | `/api/portfolios/:portfolioId/reviews` | 复盘列表、创建 |
| Review | PUT/DELETE | `/api/reviews/:id` | 编辑、删除复盘 |

## 持仓止损止盈提醒

每个持仓带两个可调参数：

| 字段 | 说明 | 默认值 |
|---|---|---|
| `stopLossPercent` | 止损比例（相对平均成本） | `0.1`（10%） |
| `takeProfitPercent` | 止盈比例（相对平均成本） | `0.08`（8%） |

- 创建持仓时未填则按止损 10%、止盈 8% 落库；历史持仓（含种子数据）继续使用默认阈值，无需补数据。
- 查询时实时计算收益率 `returnPercent = (currentPrice - avgCost) / avgCost * 100`：`returnPercent <= -止损比例*100` 标记 `STOP_LOSS`，`>= 止盈比例*100` 标记 `TAKE_PROFIT`。
- 持仓详情与组合持仓列表的每条记录返回 `returnPercent`、`alertType`（未触发为 `null`）。
- 组合详情额外返回 `alerts` 提醒列表，按 `triggeredPercent`（超出阈值的幅度，= |当前收益率| − 阈值）从高到低排序，字段为 `holdingId`、`symbol`、`returnPercent`、`alertType`。
- 数量为 0 的已清仓持仓不参与提醒。
- 阈值可通过 `PATCH /api/holdings/:id` 随时调整（传哪个改哪个）。

## 枚举使用位置清单

| 枚举 | 定义位置 | 使用位置 |
|---|---|---|
| PortfolioType | `backend/src/constants/enums.ts` | `modules/portfolios/entities/portfolio.entity.ts`、`modules/portfolios/dto/create-portfolio.dto.ts`、`modules/portfolios/portfolios.service.ts`、`database/migrations/1710000000000-init-financeapi.ts`、`database/seeds/seed.ts` |
| RiskLevel | `backend/src/constants/enums.ts` | `modules/portfolios/entities/portfolio.entity.ts`、`modules/portfolios/dto/create-portfolio.dto.ts`、`modules/portfolios/portfolios.service.ts`、`database/migrations/1710000000000-init-financeapi.ts`、`database/seeds/seed.ts` |
| TransactionType | `backend/src/constants/enums.ts` | `modules/transactions/entities/transaction.entity.ts`、`modules/transactions/dto/create-transaction.dto.ts`、`modules/transactions/transactions.service.ts`、`database/migrations/1710000000000-init-financeapi.ts`、`database/seeds/seed.ts` |
| AssetStatus | `backend/src/constants/enums.ts` | `modules/market/entities/market-data.entity.ts`、`modules/market/market.service.ts`、`database/migrations/1710000000000-init-financeapi.ts` |
| UserRole | `backend/src/constants/enums.ts` | `modules/auth/entities/user.entity.ts`、`modules/auth/dto/register.dto.ts`、`modules/auth/strategies/jwt.strategy.ts`、`common/guards/roles.guard.ts`、`constants/permissions.ts`、`database/seeds/seed.ts` |
| AlertType | `backend/src/constants/enums.ts` | `modules/holdings/holdings.service.ts`（持仓止损/止盈提醒判定） |

## RBAC 权限矩阵

| 角色 | 投资组合 | 持仓/交易 | 市场数据 | 系统管理 |
|---|---|---|---|---|
| USER | 仅本人 | 仅本人 | 读取 | 无 |
| PREMIUM | 仅本人，组合上限更高 | 仅本人 | 读取，高限流 | 无 |
| ADMIN | 全部 | 全部 | 读取/管理 | 全部 |

## 全局异常处理

`backend/src/common/filters/http-exception.filter.ts` 捕获业务 HTTP 异常，`all-exceptions.filter.ts` 捕获未处理异常。正常响应经 `transform.interceptor.ts` 统一包装为：

```json
{ "statusCode": 200, "message": "success", "data": {}, "timestamp": "...", "path": "/api/..." }
```

## 操作日志

`backend/src/common/interceptors/audit.interceptor.ts` 拦截 POST/PUT/PATCH/DELETE，记录用户、动作、目标路径、请求摘要、IP、UA。交易、删除组合、删除持仓等关键写操作都会进入审计服务。表结构见 `backend/src/modules/audit/entities/audit-log.entity.ts`。

## Redis 缓存策略

| 接口 | TTL |
|---|---|
| `/api/market/quote/:symbol` | 60 秒 |
| `/api/market/history/:symbol` | 300 秒 |
| `/api/market/search` | 600 秒 |

当前开发实现返回 `cacheTtlSeconds` 字段用于验证策略；Docker 配置提供 Redis 服务，生产可替换 `CacheHintInterceptor` 接入真实 Redis。

## API 测试示例

```bash
curl http://localhost:38505/api/health

TOKEN=$(curl -s -X POST http://localhost:38505/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"Passw0rd!","name":"用户"}' | jq -r '.data.accessToken')

curl -H "Authorization: Bearer $TOKEN" http://localhost:38505/api/portfolios

curl -X POST http://localhost:38505/api/portfolios \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"指数增强","type":"MIXED","riskLevel":"MODERATE"}'

curl -X POST http://localhost:38505/api/holdings/1/transactions \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"type":"BUY","quantity":2,"price":190,"fee":1}'

# 调整持仓止损/止盈比例（0.05 = 5%）
curl -X PATCH http://localhost:38505/api/holdings/1 \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"stopLossPercent":0.05,"takeProfitPercent":0.03}'

curl -H "Authorization: Bearer $TOKEN" http://localhost:38505/api/market/quote/AAPL
```

## 目录结构

```text
backend/src/
├── modules/
│   ├── auth/
│   ├── portfolios/
│   ├── holdings/
│   ├── transactions/
│   ├── market/
│   ├── reviews/
│   └── audit/
├── common/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── decorators/
│   └── pipes/
├── config/
├── constants/
├── database/
│   ├── migrations/
│   └── seeds/
├── types/
├── utils/
├── app.module.ts
└── main.ts
```

## 环境变量

| 变量 | 说明 |
|---|---|
| `COMPOSE_PROJECT_NAME` | Compose 项目前缀，默认 `ldapi` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | PostgreSQL 配置 |
| `DATABASE_URL` | TypeORM 连接串 |
| `REDIS_URL` | Redis 连接串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `BACKEND_PORT` | 暴露端口，默认 38505 |

## Docker 说明

`docker-compose.yml` 无 `version:` 字段，顶层 `name: ldapi`。服务包括 PostgreSQL、Redis、backend，数据库与 Redis 使用命名卷持久化，后端 healthcheck 检查 `/api/health`。

## License

MIT

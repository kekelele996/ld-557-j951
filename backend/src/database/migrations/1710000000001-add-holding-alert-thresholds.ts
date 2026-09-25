import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHoldingAlertThresholds1710000000001 implements MigrationInterface {
  name = 'AddHoldingAlertThresholds1710000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE holdings ADD COLUMN stop_loss_percent DECIMAL(8,4) NOT NULL DEFAULT 10`);
    await queryRunner.query(`ALTER TABLE holdings ADD COLUMN take_profit_percent DECIMAL(8,4) NOT NULL DEFAULT 8`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE holdings DROP COLUMN IF EXISTS take_profit_percent`);
    await queryRunner.query(`ALTER TABLE holdings DROP COLUMN IF EXISTS stop_loss_percent`);
  }
}

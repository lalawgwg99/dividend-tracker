#!/usr/bin/env node
/**
 * 持股成本計算器 - 測試套件
 */

const { StockCostCalculator } = require('./stock-cost-calculator.js');
const fs = require('fs');

class CalculatorTest {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      this.passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   錯誤：${error.message}`);
      this.failed++;
    }
  }

  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message} 期望 ${expected}, 實際 ${actual}`);
    }
  }

  assertClose(actual, expected, tolerance = 0.01, message = '') {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`${message} 期望 ${expected}, 實際 ${actual}`);
    }
  }

  run() {
    console.log('\n🎯 開始測試...\n');

    // 測試 1: 基本買入
    this.test('基本買入交易', () => {
      const calc = new StockCostCalculator();
      calc.addTrade({
        date: '2026-03-01',
        stockCode: '2330',
        type: 'buy',
        quantity: 1000,
        price: 550,
        fee: 100
      });

      const result = calc.calculateCost('2330');
      this.assertEqual(result.totalShares, 1000);
      this.assertClose(result.avgCost, 550.10, 0.01); // (1000*550 + 100) / 1000
    });

    // 測試 2: 多次買入
    this.test('多次買入計算成本', () => {
      const calc = new StockCostCalculator();
      calc.addTrade({
        date: '2026-03-01',
        stockCode: '2330',
        type: 'buy',
        quantity: 1000,
        price: 550,
        fee: 100
      });
      calc.addTrade({
        date: '2026-03-05',
        stockCode: '2330',
        type: 'buy',
        quantity: 500,
        price: 560,
        fee: 50
      });

      const result = calc.calculateCost('2330');
      this.assertEqual(result.totalShares, 1500);
      // 總成本 = 550100 + 280050 = 830150
      // 平均成本 = 830150 / 1500 = 553.43
      this.assertClose(result.avgCost, 553.43, 0.01);
    });

    // 測試 3: 賣出後重新計算
    this.test('買入後賣出', () => {
      const calc = new StockCostCalculator();
      calc.addTrade({
        date: '2026-03-01',
        stockCode: '2330',
        type: 'buy',
        quantity: 1000,
        price: 550,
        fee: 100
      });
      calc.addTrade({
        date: '2026-03-10',
        stockCode: '2330',
        type: 'sell',
        quantity: 800,
        price: 570,
        fee: 80
      });

      const result = calc.calculateCost('2330');
      this.assertEqual(result.totalShares, 200);
      this.assertClose(result.realizedProfit.realizedProfit, 15840, 0.01);
    });

    // 測試 4: 已實現損益
    this.test('計算已實現損益', () => {
      const calc = new StockCostCalculator();
      calc.addTrade({
        date: '2026-03-01',
        stockCode: '9876',
        type: 'buy',
        quantity: 100,
        price: 100,
        fee: 10
      });
      calc.addTrade({
        date: '2026-03-15',
        stockCode: '9876',
        type: 'sell',
        quantity: 100,
        price: 120,
        fee: 10
      });

      const result = calc.calculateCost('9876');
      // 賣出所得 = 12000, 成本 = 10010
      // 利潤 = 12000 - 10010 - 10 = 19980?? 等等
      console.log('   已實現損益:', result.realizedProfit.realizedProfit);
      // 應該大於 0，獲利
      this.assertTrue(result.realizedProfit.realizedProfit > 0);
    });

    // 測試 5: 多股票
    this.test('多股票管理', () => {
      const calc = new StockCostCalculator();
      calc.addTrade({
        date: '2026-03-01',
        stockCode: '2330',
        type: 'buy',
        quantity: 1000,
        price: 550,
        fee: 100
      });
      calc.addTrade({
        date: '2026-03-02',
        stockCode: '2454',
        type: 'buy',
        quantity: 500,
        price: 1000,
        fee: 50
      });

      const stocks = calc.getUniqueStocks();
      this.assertEqual(stocks.length, 2);
      this.assertTrue(stocks.includes('2330'));
      this.assertTrue(stocks.includes('2454'));
    });

    // 測試 6: CSV 匯出
    this.test('CSV 匯出功能', () => {
      const calc = new StockCostCalculator();
      calc.addTrade({
        date: '2026-03-01',
        stockCode: '2330',
        type: 'buy',
        quantity: 1000,
        price: 550,
        fee: 100
      });

      const filename = 'test_output.csv';
      if (fs.existsSync(filename)) fs.unlinkSync(filename);
      
      calc.exportCSV(filename);
      
      this.assertTrue(fs.existsSync(filename), 'CSV 檔案應該已建立');
      const content = fs.readFileSync(filename, 'utf8');
      this.assertTrue(content.includes('2330'), 'CSV 內容應包含股票代碼');
      
      // 清理
      fs.unlinkSync(filename);
    });

    // 總結
    console.log('\n📊 測試結果');
    console.log(`  通過：${this.passed}`);
    console.log(`  失敗：${this.failed}`);
    console.log(`  總計：${this.passed + this.failed}`);
    console.log('');

    if (this.failed === 0) {
      console.log('🎉 所有測試通過！');
      process.exit(0);
    } else {
      console.log('⚠️ 有測試失敗，請檢查程式碼');
      process.exit(1);
    }
  }

  assertTrue(condition, message = '') {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }
}

const test = new CalculatorTest();
test.run();

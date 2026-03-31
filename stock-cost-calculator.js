#!/usr/bin/env node
/**
 * 持股成本計算工具
 * 功能：計算持股成本、可匯出 CSV/Excel
 */

const fs = require('fs');
const path = require('path');

class StockCostCalculator {
  constructor() {
    this.trades = [];
  }

  // 新增交易記錄
  addTrade({ date, stockCode, stockName, type, quantity, price, fee }) {
    // type: 'buy' 或 'sell'
    const trade = {
      date,
      stockCode,
      stockName,
      type,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      fee: parseFloat(fee) || 0,
      id: Date.now() + Math.random().toString(36).substr(2, 9)
    };
    this.trades.push(trade);
    return trade;
  }

  // 計算單一股票的成本
  calculateCost(stockCode) {
    const stockTrades = this.trades.filter(t => t.stockCode === stockCode);
    
    let totalShares = 0;
    let totalCost = 0;
    const transactions = [];

    stockTrades.sort((a, b) => new Date(a.date) - new Date(b.date));

    stockTrades.forEach(trade => {
      if (trade.type === 'buy') {
        const tradeCost = trade.quantity * trade.price + trade.fee;
        totalCost += tradeCost;
        totalShares += trade.quantity;
        transactions.push({
          ...trade,
          tradeCost,
          avgCost: totalShares > 0 ? totalCost / totalShares : 0
        });
      } else if (trade.type === 'sell') {
        const sellValue = trade.quantity * trade.price;
        const soldCost = (trade.quantity / totalShares) * totalCost;
        totalCost -= soldCost;
        totalShares -= trade.quantity;
        transactions.push({
          ...trade,
          profit: sellValue - soldCost - trade.fee,
          avgCost: totalShares > 0 ? totalCost / totalShares : 0
        });
      }
    });

    const avgCost = totalShares > 0 ? totalCost / totalShares : 0;

    return {
      stockCode,
      totalShares,
      totalCost,
      avgCost,
      transactions,
      realizedProfit: this.calculateRealizedProfit(stockCode)
    };
  }

  // 計算已實現損益
  calculateRealizedProfit(stockCode) {
    let totalProfit = 0;
    let totalShares = 0;
    let totalCost = 0;

    const stockTrades = this.trades
      .filter(t => t.stockCode === stockCode)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    stockTrades.forEach(trade => {
      if (trade.type === 'buy') {
        totalCost += trade.quantity * trade.price + trade.fee;
        totalShares += trade.quantity;
      } else if (trade.type === 'sell') {
        if (totalShares > 0) {
          const sellValue = trade.quantity * trade.price;
          const costBasis = (trade.quantity / totalShares) * totalCost;
          totalCost -= costBasis;
          totalShares -= trade.quantity;
          totalProfit += sellValue - costBasis - trade.fee;
        }
      }
    });

    return {
      realizedProfit: parseFloat(totalProfit.toFixed(2)),
      remainingShares: totalShares,
      remainingCost: totalCost
    };
  }

  // 匯出 CSV
  exportCSV(filename = 'stock_cost_report.csv') {
    let csvContent = '股票代碼，股票名稱，持有股數，總成本，平均成本，已實現損益\n';

    const stocks = this.getUniqueStocks();
    stocks.forEach(stockCode => {
      const result = this.calculateCost(stockCode);
      csvContent += `${result.stockCode},${result.stockName || ''},${result.totalShares.toFixed(0)},` +
                    `${result.totalCost.toFixed(2)},${result.avgCost.toFixed(2)},${result.realizedProfit.realizedProfit}\n`;
    });

    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log(`✅ 匯出完成：${filename}`);
    return filename;
  }

  // 匯出 Excel (需要 SheetJS)
  async exportExcel(filename = 'stock_cost_report.xlsx') {
    try {
      const XLSX = require('xlsx');
      const workbook = XLSX.utils.book_new();

      const stocks = this.getUniqueStocks();
      const data = stocks.map(stockCode => {
        const result = this.calculateCost(stockCode);
        return {
          '股票代碼': result.stockCode,
          '股票名稱': result.stockName || '',
          '持有股數': result.totalShares.toFixed(0),
          '總成本': result.totalCost.toFixed(2),
          '平均成本': result.avgCost.toFixed(2),
          '已實現損益': result.realizedProfit.realizedProfit
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, '持股成本');
      XLSX.writeFile(workbook, filename);
      
      console.log(`✅ Excel 匯出完成：${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Excel 匯出失敗，需要安裝 SheetJS:', error.message);
      console.log('請執行：npm install xlsx');
      return null;
    }
  }

  // 取得所有股票代碼
  getUniqueStocks() {
    const stocks = new Set();
    this.trades.forEach(t => stocks.add(t.stockCode));
    return Array.from(stocks);
  }

  // 顯示所有股票摘要
  showSummary() {
    console.log('\n=== 持股成本彙總 ===\n');
    const stocks = this.getUniqueStocks();
    
    stocks.forEach(stockCode => {
      const result = this.calculateCost(stockCode);
      console.log(`${result.stockCode}:`);
      console.log(`  持有股數：${result.totalShares.toFixed(0)}`);
      console.log(`  總成本：NT$${result.totalCost.toFixed(2)}`);
      console.log(`  平均成本：NT$${result.avgCost.toFixed(2)}`);
      console.log(`  已實現損益：NT$${result.realizedProfit.realizedProfit}`);
      console.log('');
    });
  }

  // 顯示交易記錄
  showTradeLog() {
    console.log('\n=== 交易記錄 ===\n');
    this.trades
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(trade => {
        const typeSymbol = trade.type === 'buy' ? '🟢 買' : '🔴 賣';
        console.log(`${trade.date} ${typeSymbol} ${trade.stockCode}`);
        console.log(`  數量：${trade.quantity}, 價格：${trade.price}, 手續費：${trade.fee}`);
        console.log('');
      });
  }
}

// CLI 使用範例
function main() {
  const calculator = new StockCostCalculator();

  // 測試資料
  calculator.addTrade({
    date: '2026-03-01',
    stockCode: '2330',
    stockName: '台積電',
    type: 'buy',
    quantity: 1000,
    price: 550,
    fee: 100
  });

  calculator.addTrade({
    date: '2026-03-05',
    stockCode: '2330',
    stockName: '台積電',
    type: 'buy',
    quantity: 500,
    price: 560,
    fee: 50
  });

  calculator.addTrade({
    date: '2026-03-10',
    stockCode: '2330',
    stockName: '台積電',
    type: 'sell',
    quantity: 800,
    price: 570,
    fee: 80
  });

  // 測試其他股票
  calculator.addTrade({
    date: '2026-03-02',
    stockCode: '2454',
    stockName: '大立光',
    type: 'buy',
    quantity: 100,
    price: 2000,
    fee: 20
  });

  console.log('📊 測試資料載入完成\n');
  calculator.showSummary();
  
  // 測試匯出
  console.log('💾 測試匯出 CSV...');
  calculator.exportCSV('test_stock_cost.csv');

  return calculator;
}

// 如果直接執行主程式
if (require.main === module) {
  main();
}

module.exports = { StockCostCalculator };

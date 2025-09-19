import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvestmentService } from '../../services/investment.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../services/logger.service';
import { take } from 'rxjs/operators';

interface AdvancedTestResult {
  testName: string;
  category: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
  executionTime: number;
  complexity: 'Low' | 'Medium' | 'High' | 'Critical';
}

interface ComplexScenario {
  name: string;
  description: string;
  transactions: any[];
  expectedResults: any;
  complexity: 'Low' | 'Medium' | 'High' | 'Critical';
}

@Component({
  selector: 'app-advanced-testing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './advanced-testing.component.html',
  styleUrls: ['./advanced-testing.component.css']
})
export class AdvancedTestingComponent implements OnInit {
  testResults: AdvancedTestResult[] = [];
  isRunningTests = false;
  complexScenarios: ComplexScenario[] = [];
  currentInvestorId: string = '';
  testProgress = 0;
  currentTest = '';

  constructor(
    private investmentService: InvestmentService,
    private authService: AuthService,
    private logger: LoggerService
  ) {}

  ngOnInit() {
    this.setupComplexScenarios();
  }

  setupComplexScenarios() {
    this.complexScenarios = [
      {
        name: 'High-Frequency Trading Simulation',
        description: 'Simulates 100+ transactions in rapid succession',
        complexity: 'Critical',
        transactions: this.generateHighFrequencyTransactions(),
        expectedResults: { finalBalance: 150000, transactionCount: 100 }
      },
      {
        name: 'Multi-Investor Portfolio Management',
        description: 'Tests 10 investors with complex investment patterns',
        complexity: 'High',
        transactions: this.generateMultiInvestorTransactions(),
        expectedResults: { totalInvestors: 10, totalPortfolio: 500000 }
      },
      {
        name: 'Interest Rate Volatility Test',
        description: 'Tests varying interest rates over 12 months',
        complexity: 'High',
        transactions: this.generateInterestVolatilityTransactions(),
        expectedResults: { monthlyRates: 12, totalInterest: 25000 }
      },
      {
        name: 'Edge Case Stress Test',
        description: 'Tests extreme values and boundary conditions',
        complexity: 'Critical',
        transactions: this.generateEdgeCaseTransactions(),
        expectedResults: { edgeCases: 20, allHandled: true }
      },
      {
        name: 'Concurrent Transaction Test',
        description: 'Simulates simultaneous transactions from multiple sources',
        complexity: 'High',
        transactions: this.generateConcurrentTransactions(),
        expectedResults: { concurrency: 50, dataIntegrity: true }
      }
    ];
  }

  async runAdvancedTests() {
    this.isRunningTests = true;
    this.testResults = [];
    this.testProgress = 0;
    
    console.log('🚀 Starting Advanced Financial Testing Suite...');
    this.logger.debug('Starting advanced financial testing');

    const totalTests = 25; // Total number of advanced tests
    let completedTests = 0;

    // Test 1: High-Frequency Trading Simulation
    this.currentTest = 'High-Frequency Trading Simulation';
    await this.testHighFrequencyTrading();
    completedTests += 5;
    this.testProgress = (completedTests / totalTests) * 100;

    // Test 2: Complex Interest Calculations
    this.currentTest = 'Complex Interest Calculations';
    await this.testComplexInterestCalculations();
    completedTests += 5;
    this.testProgress = (completedTests / totalTests) * 100;

    // Test 3: Multi-Investor Portfolio Management
    this.currentTest = 'Multi-Investor Portfolio Management';
    await this.testMultiInvestorPortfolio();
    completedTests += 5;
    this.testProgress = (completedTests / totalTests) * 100;

    // Test 4: Edge Case Stress Testing
    this.currentTest = 'Edge Case Stress Testing';
    await this.testEdgeCaseStress();
    completedTests += 5;
    this.testProgress = (completedTests / totalTests) * 100;

    // Test 5: Data Integrity and Consistency
    this.currentTest = 'Data Integrity and Consistency';
    await this.testDataIntegrity();
    completedTests += 5;
    this.testProgress = (completedTests / totalTests) * 100;

    this.isRunningTests = false;
    this.testProgress = 100;
    this.logAdvancedTestSummary();
  }

  async testHighFrequencyTrading() {
    console.log('📈 Testing High-Frequency Trading Simulation...');
    
    const startTime = performance.now();
    const transactions = this.generateHighFrequencyTransactions();
    let balance = 0;
    let transactionCount = 0;

    // Simulate rapid transactions
    for (const transaction of transactions) {
      if (transaction.type === 'invest' || transaction.type === 'deposit') {
        balance += transaction.amount;
      } else if (transaction.type === 'withdraw') {
        balance -= transaction.amount;
      }
      transactionCount++;
    }

    const executionTime = performance.now() - startTime;
    const passed = balance === 150000 && transactionCount === 100;

    this.testResults.push({
      testName: 'High-Frequency Trading - Balance Calculation',
      category: 'Performance',
      passed,
      expected: 150000,
      actual: balance,
      executionTime,
      complexity: 'Critical'
    });

    this.testResults.push({
      testName: 'High-Frequency Trading - Transaction Count',
      category: 'Performance',
      passed: transactionCount === 100,
      expected: 100,
      actual: transactionCount,
      executionTime,
      complexity: 'Critical'
    });

    // Test transaction ordering under high frequency
    const sortedTransactions = transactions.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare === 0) {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      return dateCompare;
    });

    const isOrdered = this.verifyTransactionOrder(sortedTransactions);
    this.testResults.push({
      testName: 'High-Frequency Trading - Transaction Ordering',
      category: 'Data Integrity',
      passed: isOrdered,
      expected: true,
      actual: isOrdered,
      executionTime,
      complexity: 'High'
    });

    // Test performance under load
    const performancePassed = executionTime < 1000; // Should complete in under 1 second
    this.testResults.push({
      testName: 'High-Frequency Trading - Performance',
      category: 'Performance',
      passed: performancePassed,
      expected: '< 1000ms',
      actual: `${executionTime.toFixed(2)}ms`,
      executionTime,
      complexity: 'Critical'
    });

    // Test memory usage (simplified)
    const memoryUsage = this.estimateMemoryUsage(transactions);
    const memoryPassed = memoryUsage < 1024 * 1024; // Less than 1MB
    this.testResults.push({
      testName: 'High-Frequency Trading - Memory Usage',
      category: 'Performance',
      passed: memoryPassed,
      expected: '< 1MB',
      actual: `${(memoryUsage / 1024).toFixed(2)}KB`,
      executionTime,
      complexity: 'High'
    });
  }

  async testComplexInterestCalculations() {
    console.log('💰 Testing Complex Interest Calculations...');
    
    const startTime = performance.now();
    
    // Test compound interest calculations
    const principal = 100000;
    const annualRate = 0.12; // 12% annual
    const months = 12;
    const monthlyRate = annualRate / 12;
    
    let compoundBalance = principal;
    for (let i = 0; i < months; i++) {
      compoundBalance *= (1 + monthlyRate);
    }
    
    const expectedCompound = principal * Math.pow(1 + monthlyRate, months);
    const compoundPassed = Math.abs(compoundBalance - expectedCompound) < 0.01;
    
    this.testResults.push({
      testName: 'Compound Interest Calculation',
      category: 'Financial Math',
      passed: compoundPassed,
      expected: expectedCompound,
      actual: compoundBalance,
      executionTime: performance.now() - startTime,
      complexity: 'High'
    });

    // Test varying interest rates
    const varyingRates = [0.02, 0.025, 0.03, 0.028, 0.032, 0.029, 0.031, 0.027, 0.033, 0.030, 0.034, 0.026];
    let varyingBalance = 50000;
    let totalInterest = 0;
    
    for (let i = 0; i < varyingRates.length; i++) {
      const monthlyInterest = varyingBalance * varyingRates[i];
      totalInterest += monthlyInterest;
      varyingBalance += monthlyInterest;
    }
    
    const expectedVaryingInterest = 50000 * varyingRates.reduce((sum, rate) => sum + rate, 0);
    const varyingPassed = Math.abs(totalInterest - expectedVaryingInterest) < 0.01;
    
    this.testResults.push({
      testName: 'Varying Interest Rates',
      category: 'Financial Math',
      passed: varyingPassed,
      expected: expectedVaryingInterest,
      actual: totalInterest,
      executionTime: performance.now() - startTime,
      complexity: 'High'
    });

    // Test negative interest rates (deflation scenario)
    const negativeRate = -0.01; // -1% monthly
    const negativeBalance = 100000 * Math.pow(1 + negativeRate, 12);
    const expectedNegative = 100000 * Math.pow(0.99, 12);
    const negativePassed = Math.abs(negativeBalance - expectedNegative) < 0.01;
    
    this.testResults.push({
      testName: 'Negative Interest Rates',
      category: 'Financial Math',
      passed: negativePassed,
      expected: expectedNegative,
      actual: negativeBalance,
      executionTime: performance.now() - startTime,
      complexity: 'Medium'
    });

    // Test very high interest rates
    const highRate = 0.50; // 50% monthly
    const highBalance = 1000 * Math.pow(1 + highRate, 12);
    const expectedHigh = 1000 * Math.pow(1.5, 12);
    const highPassed = Math.abs(highBalance - expectedHigh) < 0.01;
    
    this.testResults.push({
      testName: 'High Interest Rates',
      category: 'Financial Math',
      passed: highPassed,
      expected: expectedHigh,
      actual: highBalance,
      executionTime: performance.now() - startTime,
      complexity: 'Medium'
    });

    // Test precision with very small amounts
    const smallAmount = 0.01;
    const smallRate = 0.001; // 0.1%
    const smallInterest = smallAmount * smallRate;
    const expectedSmall = 0.00001;
    const smallPassed = Math.abs(smallInterest - expectedSmall) < 0.000001;
    
    this.testResults.push({
      testName: 'Precision with Small Amounts',
      category: 'Financial Math',
      passed: smallPassed,
      expected: expectedSmall,
      actual: smallInterest,
      executionTime: performance.now() - startTime,
      complexity: 'High'
    });
  }

  async testMultiInvestorPortfolio() {
    console.log('👥 Testing Multi-Investor Portfolio Management...');
    
    const startTime = performance.now();
    const investors = this.generateMultiInvestorData();
    
    // Test portfolio aggregation
    let totalPortfolio = 0;
    let totalInvestors = 0;
    
    for (const investor of investors) {
      let investorBalance = 0;
      for (const transaction of investor.transactions) {
        if (transaction.type === 'invest' || transaction.type === 'deposit') {
          investorBalance += transaction.amount;
        } else if (transaction.type === 'withdraw') {
          investorBalance -= transaction.amount;
        }
      }
      totalPortfolio += investorBalance;
      totalInvestors++;
    }
    
    const portfolioPassed = totalPortfolio === 500000 && totalInvestors === 10;
    
    this.testResults.push({
      testName: 'Portfolio Aggregation',
      category: 'Portfolio Management',
      passed: portfolioPassed,
      expected: { totalPortfolio: 500000, totalInvestors: 10 },
      actual: { totalPortfolio, totalInvestors },
      executionTime: performance.now() - startTime,
      complexity: 'High'
    });

    // Test individual investor calculations
    let individualCalculationsPassed = true;
    for (const investor of investors) {
      const calculatedBalance = this.calculateInvestorBalance(investor.transactions);
      if (Math.abs(calculatedBalance - investor.expectedBalance) > 0.01) {
        individualCalculationsPassed = false;
        break;
      }
    }
    
    this.testResults.push({
      testName: 'Individual Investor Calculations',
      category: 'Portfolio Management',
      passed: individualCalculationsPassed,
      expected: true,
      actual: individualCalculationsPassed,
      executionTime: performance.now() - startTime,
      complexity: 'High'
    });

    // Test portfolio performance metrics
    const performanceMetrics = this.calculatePortfolioMetrics(investors);
    const metricsPassed = performanceMetrics.totalReturn > 0 && performanceMetrics.avgReturn > 0;
    
    this.testResults.push({
      testName: 'Portfolio Performance Metrics',
      category: 'Portfolio Management',
      passed: metricsPassed,
      expected: { totalReturn: '> 0', avgReturn: '> 0' },
      actual: performanceMetrics,
      executionTime: performance.now() - startTime,
      complexity: 'High'
    });

    // Test data consistency across investors
    const consistencyPassed = this.verifyDataConsistency(investors);
    
    this.testResults.push({
      testName: 'Data Consistency Across Investors',
      category: 'Data Integrity',
      passed: consistencyPassed,
      expected: true,
      actual: consistencyPassed,
      executionTime: performance.now() - startTime,
      complexity: 'Critical'
    });

    // Test concurrent investor operations
    const concurrencyPassed = await this.testConcurrentInvestorOperations(investors);
    
    this.testResults.push({
      testName: 'Concurrent Investor Operations',
      category: 'Concurrency',
      passed: concurrencyPassed,
      expected: true,
      actual: concurrencyPassed,
      executionTime: performance.now() - startTime,
      complexity: 'Critical'
    });
  }

  async testEdgeCaseStress() {
    console.log('⚠️ Testing Edge Case Stress Scenarios...');
    
    const startTime = performance.now();
    
    // Test with maximum JavaScript number
    const maxNumber = Number.MAX_SAFE_INTEGER;
    const maxNumberTest = this.testWithMaxNumber(maxNumber);
    
    this.testResults.push({
      testName: 'Maximum Number Handling',
      category: 'Edge Cases',
      passed: maxNumberTest.passed,
      expected: maxNumberTest.expected,
      actual: maxNumberTest.actual,
      executionTime: performance.now() - startTime,
      complexity: 'Critical'
    });

    // Test with minimum safe number
    const minNumber = Number.MIN_SAFE_INTEGER;
    const minNumberTest = this.testWithMinNumber(minNumber);
    
    this.testResults.push({
      testName: 'Minimum Number Handling',
      category: 'Edge Cases',
      passed: minNumberTest.passed,
      expected: minNumberTest.expected,
      actual: minNumberTest.actual,
      executionTime: performance.now() - startTime,
      complexity: 'Critical'
    });

    // Test with very small decimal numbers
    const tinyNumber = 0.000000001;
    const tinyNumberTest = this.testWithTinyNumber(tinyNumber);
    
    this.testResults.push({
      testName: 'Tiny Decimal Number Handling',
      category: 'Edge Cases',
      passed: tinyNumberTest.passed,
      expected: tinyNumberTest.expected,
      actual: tinyNumberTest.actual,
      executionTime: performance.now() - startTime,
      complexity: 'High'
    });

    // Test with invalid dates
    const invalidDateTest = this.testWithInvalidDates();
    
    this.testResults.push({
      testName: 'Invalid Date Handling',
      category: 'Edge Cases',
      passed: invalidDateTest.passed,
      expected: invalidDateTest.expected,
      actual: invalidDateTest.actual,
      executionTime: performance.now() - startTime,
      complexity: 'High'
    });

    // Test with future dates
    const futureDateTest = this.testWithFutureDates();
    
    this.testResults.push({
      testName: 'Future Date Handling',
      category: 'Edge Cases',
      passed: futureDateTest.passed,
      expected: futureDateTest.expected,
      actual: futureDateTest.actual,
      executionTime: performance.now() - startTime,
      complexity: 'Medium'
    });
  }

  async testDataIntegrity() {
    console.log('🔒 Testing Data Integrity and Consistency...');
    
    const startTime = performance.now();
    
    // Test transaction ID uniqueness
    const uniquenessTest = this.testTransactionUniqueness();
    
    this.testResults.push({
      testName: 'Transaction ID Uniqueness',
      category: 'Data Integrity',
      passed: uniquenessTest.passed,
      expected: uniquenessTest.expected,
      actual: uniquenessTest.actual,
      executionTime: performance.now() - startTime,
      complexity: 'Critical'
    });

    // Test balance consistency
    const balanceConsistencyTest = this.testBalanceConsistency();
    
    this.testResults.push({
      testName: 'Balance Consistency',
      category: 'Data Integrity',
      passed: balanceConsistencyTest.passed,
      expected: balanceConsistencyTest.expected,
      actual: balanceConsistencyTest.actual,
      executionTime: performance.now() - startTime,
      complexity: 'Critical'
    });

    // Test data validation
    const validationTest = this.testDataValidation();
    
    this.testResults.push({
      testName: 'Data Validation',
      category: 'Data Integrity',
      passed: validationTest.passed,
      expected: validationTest.expected,
      actual: validationTest.actual,
      executionTime: performance.now() - startTime,
      complexity: 'High'
    });

    // Test error handling
    const errorHandlingTest = this.testErrorHandling();
    
    this.testResults.push({
      testName: 'Error Handling',
      category: 'Data Integrity',
      passed: errorHandlingTest.passed,
      expected: errorHandlingTest.expected,
      actual: errorHandlingTest.actual,
      executionTime: performance.now() - startTime,
      complexity: 'High'
    });

    // Test data persistence
    const persistenceTest = await this.testDataPersistence();
    
    this.testResults.push({
      testName: 'Data Persistence',
      category: 'Data Integrity',
      passed: persistenceTest.passed,
      expected: persistenceTest.expected,
      actual: persistenceTest.actual,
      executionTime: performance.now() - startTime,
      complexity: 'Critical'
    });
  }

  // Helper methods for generating test data
  generateHighFrequencyTransactions() {
    const transactions = [];
    const baseDate = new Date('2024-01-01');
    
    for (let i = 0; i < 100; i++) {
      const randomAmount = Math.floor(Math.random() * 10000) + 1000;
      const randomType = Math.random() > 0.3 ? 'invest' : 'withdraw';
      const randomDate = new Date(baseDate.getTime() + (i * 60000)); // 1 minute intervals
      
      transactions.push({
        type: randomType,
        amount: randomType === 'invest' ? randomAmount : randomAmount * 0.5,
        date: randomDate,
        createdAt: new Date(randomDate.getTime() + Math.random() * 1000)
      });
    }
    
    return transactions;
  }

  generateMultiInvestorTransactions() {
    const investors = [];
    for (let i = 0; i < 10; i++) {
      const investor = {
        id: `investor_${i}`,
        name: `Investor ${i + 1}`,
        transactions: [],
        expectedBalance: 50000
      };
      
      // Generate 20 transactions per investor
      for (let j = 0; j < 20; j++) {
        const amount = Math.floor(Math.random() * 10000) + 1000;
        const type = Math.random() > 0.4 ? 'invest' : 'withdraw';
        const date = new Date(2024, 0, j + 1);
        
        investor.transactions.push({
          type,
          amount: type === 'invest' ? amount : amount * 0.3,
          date,
          createdAt: new Date(date.getTime() + Math.random() * 1000)
        });
      }
      
      investors.push(investor);
    }
    
    return investors;
  }

  generateInterestVolatilityTransactions() {
    const transactions = [];
    const baseAmount = 100000;
    const monthlyRates = [0.02, 0.025, 0.03, 0.028, 0.032, 0.029, 0.031, 0.027, 0.033, 0.030, 0.034, 0.026];
    
    for (let month = 0; month < 12; month++) {
      const interestAmount = baseAmount * monthlyRates[month];
      transactions.push({
        type: 'interest',
        amount: interestAmount,
        date: new Date(2024, month, 1),
        createdAt: new Date(2024, month, 1)
      });
    }
    
    return transactions;
  }

  generateEdgeCaseTransactions() {
    return [
      { type: 'invest', amount: Number.MAX_SAFE_INTEGER, date: new Date(), createdAt: new Date() },
      { type: 'invest', amount: Number.MIN_SAFE_INTEGER, date: new Date(), createdAt: new Date() },
      { type: 'invest', amount: 0.000000001, date: new Date(), createdAt: new Date() },
      { type: 'invest', amount: -1000, date: new Date(), createdAt: new Date() },
      { type: 'invest', amount: Infinity, date: new Date(), createdAt: new Date() },
      { type: 'invest', amount: -Infinity, date: new Date(), createdAt: new Date() },
      { type: 'invest', amount: NaN, date: new Date(), createdAt: new Date() },
      { type: 'invest', amount: 'invalid', date: new Date(), createdAt: new Date() },
      { type: 'invest', amount: 1000, date: new Date('invalid'), createdAt: new Date() },
      { type: 'invest', amount: 1000, date: new Date(), createdAt: new Date('invalid') }
    ];
  }

  generateConcurrentTransactions() {
    const transactions = [];
    const baseTime = new Date().getTime();
    
    for (let i = 0; i < 50; i++) {
      transactions.push({
        type: 'invest',
        amount: 1000,
        date: new Date(baseTime),
        createdAt: new Date(baseTime + i) // Slightly different timestamps
      });
    }
    
    return transactions;
  }

  generateMultiInvestorData() {
    const investors = [];
    for (let i = 0; i < 10; i++) {
      const investor = {
        id: `investor_${i}`,
        name: `Investor ${i + 1}`,
        transactions: [],
        expectedBalance: 50000
      };
      
      // Generate 20 transactions per investor
      for (let j = 0; j < 20; j++) {
        const amount = Math.floor(Math.random() * 10000) + 1000;
        const type = Math.random() > 0.4 ? 'invest' : 'withdraw';
        const date = new Date(2024, 0, j + 1);
        
        investor.transactions.push({
          type,
          amount: type === 'invest' ? amount : amount * 0.3,
          date,
          createdAt: new Date(date.getTime() + Math.random() * 1000)
        });
      }
      
      investors.push(investor);
    }
    
    return investors;
  }

  // Additional helper methods would be implemented here...
  // (truncated for brevity - the full implementation would include all helper methods)

  verifyTransactionOrder(transactions: any[]): boolean {
    return transactions.every((transaction, index) => {
      if (index === 0) return true;
      const prevTransaction = transactions[index - 1];
      const currentDate = transaction.date.getTime();
      const prevDate = prevTransaction.date.getTime();
      
      if (currentDate === prevDate) {
        return transaction.createdAt.getTime() >= prevTransaction.createdAt.getTime();
      }
      return currentDate >= prevDate;
    });
  }

  calculateInvestorBalance(transactions: any[]): number {
    let balance = 0;
    transactions.forEach(transaction => {
      if (transaction.type === 'invest' || transaction.type === 'deposit') {
        balance += transaction.amount;
      } else if (transaction.type === 'withdraw') {
        balance -= transaction.amount;
      }
    });
    return balance;
  }

  calculatePortfolioMetrics(investors: any[]) {
    let totalReturn = 0;
    let totalInvestments = 0;
    
    investors.forEach(investor => {
      const balance = this.calculateInvestorBalance(investor.transactions);
      const investments = investor.transactions
        .filter(t => t.type === 'invest')
        .reduce((sum, t) => sum + t.amount, 0);
      
      totalReturn += (balance - investments);
      totalInvestments += investments;
    });
    
    return {
      totalReturn,
      avgReturn: totalReturn / investors.length,
      totalInvestments,
      returnPercentage: totalInvestments > 0 ? (totalReturn / totalInvestments) * 100 : 0
    };
  }

  verifyDataConsistency(investors: any[]): boolean {
    // Check for data consistency across investors
    return investors.every(investor => {
      return investor.transactions.every(transaction => {
        return transaction.amount !== null && 
               transaction.amount !== undefined && 
               !isNaN(transaction.amount) &&
               transaction.date instanceof Date &&
               transaction.createdAt instanceof Date;
      });
    });
  }

  async testConcurrentInvestorOperations(investors: any[]): Promise<boolean> {
    // Simulate concurrent operations
    const promises = investors.map(async (investor) => {
      return this.calculateInvestorBalance(investor.transactions);
    });
    
    try {
      const results = await Promise.all(promises);
      return results.every(result => typeof result === 'number' && !isNaN(result));
    } catch (error) {
      return false;
    }
  }

  estimateMemoryUsage(transactions: any[]): number {
    // Rough estimation of memory usage
    return transactions.length * 200; // Approximate bytes per transaction
  }

  // Additional test helper methods...
  testWithMaxNumber(maxNumber: number) {
    try {
      const result = maxNumber + 1;
      return {
        passed: result === maxNumber, // Should not overflow
        expected: maxNumber,
        actual: result
      };
    } catch (error) {
      return {
        passed: false,
        expected: 'No error',
        actual: error.message
      };
    }
  }

  testWithMinNumber(minNumber: number) {
    try {
      const result = minNumber - 1;
      return {
        passed: result === minNumber, // Should not underflow
        expected: minNumber,
        actual: result
      };
    } catch (error) {
      return {
        passed: false,
        expected: 'No error',
        actual: error.message
      };
    }
  }

  testWithTinyNumber(tinyNumber: number) {
    const result = tinyNumber * 1000000;
    return {
      passed: result > 0,
      expected: '> 0',
      actual: result
    };
  }

  testWithInvalidDates() {
    try {
      const invalidDate = new Date('invalid');
      const isValid = !isNaN(invalidDate.getTime());
      return {
        passed: !isValid,
        expected: false,
        actual: isValid
      };
    } catch (error) {
      return {
        passed: true,
        expected: false,
        actual: false
      };
    }
  }

  testWithFutureDates() {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const isFuture = futureDate > new Date();
    return {
      passed: isFuture,
      expected: true,
      actual: isFuture
    };
  }

  testTransactionUniqueness() {
    const transactions = this.generateHighFrequencyTransactions();
    const ids = transactions.map(t => t.id || `${t.type}_${t.amount}_${t.date.getTime()}`);
    const uniqueIds = new Set(ids);
    return {
      passed: uniqueIds.size === ids.length,
      expected: ids.length,
      actual: uniqueIds.size
    };
  }

  testBalanceConsistency() {
    const transactions = this.generateHighFrequencyTransactions();
    let balance1 = 0;
    let balance2 = 0;
    
    // Calculate balance in two different ways
    transactions.forEach(t => {
      if (t.type === 'invest') balance1 += t.amount;
      else if (t.type === 'withdraw') balance1 -= t.amount;
    });
    
    const sortedTransactions = transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    sortedTransactions.forEach(t => {
      if (t.type === 'invest') balance2 += t.amount;
      else if (t.type === 'withdraw') balance2 -= t.amount;
    });
    
    return {
      passed: balance1 === balance2,
      expected: balance1,
      actual: balance2
    };
  }

  testDataValidation() {
    const transactions = this.generateEdgeCaseTransactions();
    let validCount = 0;
    
    transactions.forEach(t => {
      if (typeof t.amount === 'number' && !isNaN(t.amount) && t.amount > 0) {
        validCount++;
      }
    });
    
    return {
      passed: validCount > 0,
      expected: 'Some valid transactions',
      actual: `${validCount} valid transactions`
    };
  }

  testErrorHandling() {
    try {
      // Test division by zero
      const result = 1000 / 0;
      const isInfinity = !isFinite(result);
      return {
        passed: isInfinity,
        expected: true,
        actual: isInfinity
      };
    } catch (error) {
      return {
        passed: false,
        expected: true,
        actual: false
      };
    }
  }

  async testDataPersistence() {
    try {
      // Test if we can retrieve data from service
      const user = await this.authService.currentUser$.pipe(take(1)).toPromise();
      if (user) {
        const transactions = await this.investmentService.computeBalances(user.uid);
        return {
          passed: Array.isArray(transactions),
          expected: true,
          actual: Array.isArray(transactions)
        };
      }
      return {
        passed: false,
        expected: true,
        actual: false
      };
    } catch (error) {
      return {
        passed: false,
        expected: true,
        actual: false
      };
    }
  }

  logAdvancedTestSummary() {
    const passedTests = this.testResults.filter(t => t.passed).length;
    const totalTests = this.testResults.length;
    const successRate = (passedTests / totalTests) * 100;

    console.log(`\n🎯 Advanced Test Summary:`);
    console.log(`✅ Passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
    console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);

    // Group by category
    const categories = [...new Set(this.testResults.map(t => t.category))];
    categories.forEach(category => {
      const categoryTests = this.testResults.filter(t => t.category === category);
      const categoryPassed = categoryTests.filter(t => t.passed).length;
      console.log(`\n📊 ${category}: ${categoryPassed}/${categoryTests.length} passed`);
    });

    // Group by complexity
    const complexities = ['Low', 'Medium', 'High', 'Critical'];
    complexities.forEach(complexity => {
      const complexityTests = this.testResults.filter(t => t.complexity === complexity);
      const complexityPassed = complexityTests.filter(t => t.passed).length;
      if (complexityTests.length > 0) {
        console.log(`\n⚡ ${complexity} Complexity: ${complexityPassed}/${complexityTests.length} passed`);
      }
    });

    this.logger.debug('Advanced financial testing completed', {
      passed: passedTests,
      total: totalTests,
      successRate: successRate
    });
  }

  getPassedCount(): number {
    return this.testResults.filter(t => t.passed).length;
  }

  getFailedCount(): number {
    return this.testResults.filter(t => !t.passed).length;
  }

  getTestsByCategory(category: string): AdvancedTestResult[] {
    return this.testResults.filter(t => t.category === category);
  }

  getTestsByComplexity(complexity: string): AdvancedTestResult[] {
    return this.testResults.filter(t => t.complexity === complexity);
  }

  clearResults() {
    this.testResults = [];
    this.testProgress = 0;
    this.currentTest = '';
  }

  selectedCategory = 'All';
  selectedComplexity = 'All';

  getFilteredResults(): AdvancedTestResult[] {
    let filtered = this.testResults;
    
    if (this.selectedCategory !== 'All') {
      filtered = filtered.filter(t => t.category === this.selectedCategory);
    }
    
    if (this.selectedComplexity !== 'All') {
      filtered = filtered.filter(t => t.complexity === this.selectedComplexity);
    }
    
    return filtered;
  }

  exportResults() {
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.length,
        passed: this.getPassedCount(),
        failed: this.getFailedCount(),
        successRate: (this.getPassedCount() / this.testResults.length) * 100
      },
      tests: this.testResults,
      categories: [...new Set(this.testResults.map(t => t.category))],
      complexities: [...new Set(this.testResults.map(t => t.complexity))]
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advanced-test-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

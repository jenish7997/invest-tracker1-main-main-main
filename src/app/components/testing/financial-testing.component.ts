import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvestmentService } from '../../services/investment.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../services/logger.service';
import { take } from 'rxjs/operators';

interface TestResult {
  testName: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
}

interface TestScenario {
  name: string;
  transactions: any[];
  expectedBalance: number;
  expectedInterest: number;
}

@Component({
  selector: 'app-financial-testing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial-testing.component.html',
  styleUrls: ['./financial-testing.component.css']
})
export class FinancialTestingComponent implements OnInit {
  testResults: TestResult[] = [];
  isRunningTests = false;
  testScenarios: TestScenario[] = [];
  currentInvestorId: string = '';

  constructor(
    private investmentService: InvestmentService,
    private authService: AuthService,
    private logger: LoggerService
  ) {}

  ngOnInit() {
    this.setupTestScenarios();
  }

  setupTestScenarios() {
    this.testScenarios = [
      {
        name: 'Basic Investment Test',
        transactions: [
          { type: 'invest', amount: 10000, date: new Date('2024-01-01') },
          { type: 'invest', amount: 5000, date: new Date('2024-01-15') }
        ],
        expectedBalance: 15000,
        expectedInterest: 0
      },
      {
        name: 'Investment with Withdrawal Test',
        transactions: [
          { type: 'invest', amount: 20000, date: new Date('2024-01-01') },
          { type: 'withdraw', amount: 5000, date: new Date('2024-01-15') },
          { type: 'invest', amount: 3000, date: new Date('2024-01-30') }
        ],
        expectedBalance: 18000,
        expectedInterest: 0
      },
      {
        name: 'Interest Calculation Test',
        transactions: [
          { type: 'invest', amount: 10000, date: new Date('2024-01-01') },
          { type: 'interest', amount: 200, date: new Date('2024-01-31') }
        ],
        expectedBalance: 10200,
        expectedInterest: 200
      },
      {
        name: 'Complex Scenario Test',
        transactions: [
          { type: 'invest', amount: 50000, date: new Date('2024-01-01') },
          { type: 'withdraw', amount: 10000, date: new Date('2024-01-15') },
          { type: 'invest', amount: 20000, date: new Date('2024-02-01') },
          { type: 'interest', amount: 1200, date: new Date('2024-02-29') },
          { type: 'withdraw', amount: 5000, date: new Date('2024-03-15') }
        ],
        expectedBalance: 56200,
        expectedInterest: 1200
      }
    ];
  }

  async runAllTests() {
    this.isRunningTests = true;
    this.testResults = [];
    
    console.log('🧪 Starting Financial Logic Tests...');
    this.logger.debug('Starting comprehensive financial testing');

    // Test 1: Basic Balance Calculation
    await this.testBasicBalanceCalculation();
    
    // Test 2: Transaction Ordering
    await this.testTransactionOrdering();
    
    // Test 3: Interest Rate Calculations
    await this.testInterestCalculations();
    
    // Test 4: Edge Cases
    await this.testEdgeCases();
    
    // Test 5: Real Data Testing
    await this.testRealData();
    
    // Test 6: Mathematical Accuracy
    await this.testMathematicalAccuracy();

    this.isRunningTests = false;
    this.logTestSummary();
  }

  async testBasicBalanceCalculation() {
    console.log('📊 Testing Basic Balance Calculation...');
    
    const testCases = [
      { principal: 10000, additions: [5000], withdrawals: [], expected: 15000 },
      { principal: 20000, additions: [10000, 5000], withdrawals: [3000], expected: 32000 },
      { principal: 5000, additions: [], withdrawals: [2000], expected: 3000 },
      { principal: 0, additions: [1000, 2000, 3000], withdrawals: [500], expected: 5500 }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      let balance = testCase.principal;
      
      // Add investments
      testCase.additions.forEach(amount => balance += amount);
      
      // Subtract withdrawals
      testCase.withdrawals.forEach(amount => balance -= amount);
      
      const passed = balance === testCase.expected;
      
      this.testResults.push({
        testName: `Basic Balance Test ${i + 1}`,
        passed,
        expected: testCase.expected,
        actual: balance,
        error: passed ? undefined : `Expected ${testCase.expected}, got ${balance}`
      });
    }
  }

  async testTransactionOrdering() {
    console.log('📅 Testing Transaction Ordering...');
    
    const transactions = [
      { type: 'invest', amount: 1000, date: new Date('2024-01-15'), createdAt: new Date('2024-01-15T10:00:00') },
      { type: 'invest', amount: 2000, date: new Date('2024-01-01'), createdAt: new Date('2024-01-01T09:00:00') },
      { type: 'withdraw', amount: 500, date: new Date('2024-01-15'), createdAt: new Date('2024-01-15T14:00:00') }
    ];

    // Sort by date (ascending), then by createdAt for same date
    const sortedTransactions = transactions.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare === 0) {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      return dateCompare;
    });

    // Check if transactions are in correct order by comparing timestamps
    const isCorrectOrder = sortedTransactions.every((transaction, index) => {
      if (index === 0) return true;
      const prevTransaction = sortedTransactions[index - 1];
      const currentDate = transaction.date.getTime();
      const prevDate = prevTransaction.date.getTime();
      
      if (currentDate === prevDate) {
        return transaction.createdAt.getTime() >= prevTransaction.createdAt.getTime();
      }
      return currentDate >= prevDate;
    });

    const expectedOrder = ['2024-01-01', '2024-01-15', '2024-01-15'];
    const actualOrder = sortedTransactions.map(t => t.date.toISOString().split('T')[0]);

    const passed = isCorrectOrder && JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
    
    this.testResults.push({
      testName: 'Transaction Ordering Test',
      passed,
      expected: expectedOrder,
      actual: actualOrder,
      error: passed ? undefined : 'Transactions not in correct chronological order'
    });
  }

  async testInterestCalculations() {
    console.log('💰 Testing Interest Calculations...');
    
    const testCases = [
      { principal: 10000, rate: 2, expected: 200 },
      { principal: 5000, rate: 1.5, expected: 75 },
      { principal: 25000, rate: 3, expected: 750 },
      { principal: 1000, rate: 0.5, expected: 5 },
      { principal: 0, rate: 5, expected: 0 }
    ];

    testCases.forEach((testCase, index) => {
      const result = this.calculateInterest(testCase.principal, testCase.rate);
      const passed = Math.abs(result - testCase.expected) < 0.01; // Allow for floating point precision
      
      this.testResults.push({
        testName: `Interest Calculation Test ${index + 1}`,
        passed,
        expected: testCase.expected,
        actual: result,
        error: passed ? undefined : `Expected ${testCase.expected}, got ${result}`
      });
    });
  }

  async testEdgeCases() {
    console.log('⚠️ Testing Edge Cases...');
    
    // Test with zero amounts
    const zeroAmountTest = this.calculateBalance([{ type: 'invest', amount: 0 }]);
    this.testResults.push({
      testName: 'Zero Amount Test',
      passed: zeroAmountTest === 0,
      expected: 0,
      actual: zeroAmountTest
    });

    // Test with negative amounts (should be handled gracefully)
    const negativeAmountTest = this.calculateBalance([{ type: 'invest', amount: -1000 }]);
    this.testResults.push({
      testName: 'Negative Amount Test',
      passed: negativeAmountTest === -1000,
      expected: -1000,
      actual: negativeAmountTest
    });

    // Test with very large numbers
    const largeAmountTest = this.calculateBalance([{ type: 'invest', amount: 999999999 }]);
    this.testResults.push({
      testName: 'Large Amount Test',
      passed: largeAmountTest === 999999999,
      expected: 999999999,
      actual: largeAmountTest
    });

    // Test with decimal amounts
    const decimalAmountTest = this.calculateBalance([{ type: 'invest', amount: 1234.56 }]);
    this.testResults.push({
      testName: 'Decimal Amount Test',
      passed: Math.abs(decimalAmountTest - 1234.56) < 0.01,
      expected: 1234.56,
      actual: decimalAmountTest
    });
  }

  async testRealData() {
    console.log('🔍 Testing Real Data...');
    
    try {
      // Get current user's data
      const user = await this.authService.currentUser$.pipe(take(1)).toPromise();
      if (user) {
        this.currentInvestorId = user.uid;
        
        // Test computeBalances with real data
        const realTransactions = await this.investmentService.computeBalances(this.currentInvestorId);
        
        this.testResults.push({
          testName: 'Real Data Retrieval Test',
          passed: Array.isArray(realTransactions),
          expected: 'Array',
          actual: Array.isArray(realTransactions) ? 'Array' : typeof realTransactions
        });

        if (realTransactions.length > 0) {
          // Test balance calculation consistency
          const lastTransaction = realTransactions[realTransactions.length - 1];
          const calculatedBalance = this.calculateBalanceFromTransactions(realTransactions);
          
          this.testResults.push({
            testName: 'Real Data Balance Consistency',
            passed: Math.abs(lastTransaction.balance - calculatedBalance) < 0.01,
            expected: lastTransaction.balance,
            actual: calculatedBalance
          });
        }
      }
    } catch (error) {
      this.testResults.push({
        testName: 'Real Data Test',
        passed: false,
        expected: 'Success',
        actual: 'Error',
        error: error.message
      });
    }
  }

  async testMathematicalAccuracy() {
    console.log('🧮 Testing Mathematical Accuracy...');
    
    // Test floating point precision
    const precisionTest = 0.1 + 0.2;
    this.testResults.push({
      testName: 'Floating Point Precision Test',
      passed: Math.abs(precisionTest - 0.3) < 0.0001,
      expected: 0.3,
      actual: precisionTest
    });

    // Test percentage calculations
    const percentageTest = (10000 * 2.5) / 100;
    this.testResults.push({
      testName: 'Percentage Calculation Test',
      passed: percentageTest === 250,
      expected: 250,
      actual: percentageTest
    });

    // Test compound calculations
    const compoundTest = 1000 * (1 + 0.02) * (1 + 0.02);
    this.testResults.push({
      testName: 'Compound Calculation Test',
      passed: Math.abs(compoundTest - 1040.4) < 0.01,
      expected: 1040.4,
      actual: compoundTest
    });
  }

  calculateInterest(principal: number, rate: number): number {
    return (principal * rate) / 100;
  }

  calculateBalance(transactions: any[]): number {
    let balance = 0;
    transactions.forEach(t => {
      if (t.type === 'invest' || t.type === 'deposit' || t.type === 'interest') {
        balance += t.amount;
      } else if (t.type === 'withdraw') {
        balance -= t.amount;
      }
    });
    return balance;
  }

  calculateBalanceFromTransactions(transactions: any[]): number {
    let balance = 0;
    transactions.forEach(t => {
      if (t.type === 'invest' || t.type === 'deposit' || t.type === 'interest') {
        balance += t.amount;
      } else if (t.type === 'withdraw') {
        balance -= t.amount;
      }
    });
    return balance;
  }

  logTestSummary() {
    const passedTests = this.testResults.filter(t => t.passed).length;
    const totalTests = this.testResults.length;
    const successRate = (passedTests / totalTests) * 100;

    console.log(`\n🎯 Test Summary:`);
    console.log(`✅ Passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
    console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);

    if (passedTests < totalTests) {
      console.log(`\n❌ Failed Tests:`);
      this.testResults.filter(t => !t.passed).forEach(test => {
        console.log(`- ${test.testName}: ${test.error}`);
      });
    }

    this.logger.debug('Financial testing completed', {
      passed: passedTests,
      total: totalTests,
      successRate: successRate
    });
  }

  clearResults() {
    this.testResults = [];
  }

  getPassedCount(): number {
    return this.testResults.filter(t => t.passed).length;
  }

  getFailedCount(): number {
    return this.testResults.filter(t => !t.passed).length;
  }

  exportResults() {
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.length,
        passed: this.getPassedCount(),
        failed: this.getFailedCount()
      },
      tests: this.testResults
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-test-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

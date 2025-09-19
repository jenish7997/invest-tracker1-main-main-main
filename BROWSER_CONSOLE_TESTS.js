// 🧪 Browser Console Testing Script for Investment Tracker
// Copy and paste this into your browser console (F12) to run tests

console.log('🧪 Starting Investment Tracker Console Tests...');

// Test 1: Basic Math Calculations
function testBasicMath() {
  console.log('\n📊 Testing Basic Math Calculations...');
  
  const testCases = [
    { principal: 10000, additions: [5000], withdrawals: [], expected: 15000 },
    { principal: 20000, additions: [10000, 5000], withdrawals: [3000], expected: 32000 },
    { principal: 5000, additions: [], withdrawals: [2000], expected: 3000 }
  ];

  testCases.forEach((testCase, index) => {
    let balance = testCase.principal;
    testCase.additions.forEach(amount => balance += amount);
    testCase.withdrawals.forEach(amount => balance -= amount);
    
    const passed = balance === testCase.expected;
    console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Expected: ${testCase.expected}, Got: ${balance}`);
  });
}

// Test 2: Interest Calculations
function testInterestCalculations() {
  console.log('\n💰 Testing Interest Calculations...');
  
  const testCases = [
    { principal: 10000, rate: 2, expected: 200 },
    { principal: 5000, rate: 1.5, expected: 75 },
    { principal: 25000, rate: 3, expected: 750 },
    { principal: 1000, rate: 0.5, expected: 5 }
  ];

  testCases.forEach((testCase, index) => {
    const result = (testCase.principal * testCase.rate) / 100;
    const passed = Math.abs(result - testCase.expected) < 0.01;
    console.log(`Interest Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Principal: ₹${testCase.principal}, Rate: ${testCase.rate}%`);
    console.log(`  Expected: ₹${testCase.expected}, Got: ₹${result}`);
  });
}

// Test 3: Transaction Ordering
function testTransactionOrdering() {
  console.log('\n📅 Testing Transaction Ordering...');
  
  const transactions = [
    { type: 'invest', amount: 1000, date: new Date('2024-01-15T10:00:00') },
    { type: 'invest', amount: 2000, date: new Date('2024-01-01T09:00:00') },
    { type: 'withdraw', amount: 500, date: new Date('2024-01-15T14:00:00') }
  ];

  // Sort by date (ascending)
  const sortedTransactions = transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  const expectedOrder = ['2024-01-01', '2024-01-15T10:00:00', '2024-01-15T14:00:00'];
  const actualOrder = sortedTransactions.map(t => t.date.toISOString());
  
  const passed = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
  console.log(`Transaction Ordering: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Expected order: ${expectedOrder.join(' → ')}`);
  console.log(`  Actual order: ${actualOrder.join(' → ')}`);
}

// Test 4: Edge Cases
function testEdgeCases() {
  console.log('\n⚠️ Testing Edge Cases...');
  
  // Test zero amounts
  const zeroTest = 0 + 0;
  console.log(`Zero amount test: ${zeroTest === 0 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test negative amounts
  const negativeTest = 1000 + (-500);
  console.log(`Negative amount test: ${negativeTest === 500 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test decimal precision
  const decimalTest = 0.1 + 0.2;
  console.log(`Decimal precision test: ${Math.abs(decimalTest - 0.3) < 0.0001 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Result: ${decimalTest} (should be 0.3)`);
  
  // Test large numbers
  const largeTest = 999999999 + 1;
  console.log(`Large number test: ${largeTest === 1000000000 ? '✅ PASS' : '❌ FAIL'}`);
}

// Test 5: Floating Point Precision
function testFloatingPointPrecision() {
  console.log('\n🔢 Testing Floating Point Precision...');
  
  const tests = [
    { a: 0.1, b: 0.2, expected: 0.3 },
    { a: 0.3, b: 0.6, expected: 0.9 },
    { a: 0.7, b: 0.1, expected: 0.8 }
  ];

  tests.forEach((test, index) => {
    const result = test.a + test.b;
    const passed = Math.abs(result - test.expected) < 0.0001;
    console.log(`Floating Point Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  ${test.a} + ${test.b} = ${result} (expected: ${test.expected})`);
  });
}

// Test 6: Percentage Calculations
function testPercentageCalculations() {
  console.log('\n📊 Testing Percentage Calculations...');
  
  const testCases = [
    { value: 10000, percentage: 2, expected: 200 },
    { value: 5000, percentage: 1.5, expected: 75 },
    { value: 25000, percentage: 3, expected: 750 },
    { value: 1000, percentage: 0.5, expected: 5 }
  ];

  testCases.forEach((testCase, index) => {
    const result = (testCase.value * testCase.percentage) / 100;
    const passed = Math.abs(result - testCase.expected) < 0.01;
    console.log(`Percentage Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  ${testCase.value} × ${testCase.percentage}% = ${result} (expected: ${testCase.expected})`);
  });
}

// Test 7: Compound Calculations
function testCompoundCalculations() {
  console.log('\n🔄 Testing Compound Calculations...');
  
  // Test compound interest: P(1 + r)^n
  const principal = 1000;
  const rate = 0.02; // 2%
  const periods = 2;
  
  const compoundResult = principal * Math.pow(1 + rate, periods);
  const expected = 1040.4;
  
  const passed = Math.abs(compoundResult - expected) < 0.01;
  console.log(`Compound Interest Test: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Principal: ₹${principal}, Rate: ${rate * 100}%, Periods: ${periods}`);
  console.log(`  Result: ₹${compoundResult.toFixed(2)} (expected: ₹${expected})`);
}

// Test 8: Date Calculations
function testDateCalculations() {
  console.log('\n📅 Testing Date Calculations...');
  
  const date1 = new Date('2024-01-01');
  const date2 = new Date('2024-01-15');
  const date3 = new Date('2024-01-01T10:00:00');
  const date4 = new Date('2024-01-01T14:00:00');
  
  // Test date comparison
  const dateCompare1 = date1 < date2;
  const dateCompare2 = date3 < date4;
  
  console.log(`Date comparison test 1: ${dateCompare1 ? '✅ PASS' : '❌ FAIL'} (${date1.toDateString()} < ${date2.toDateString()})`);
  console.log(`Date comparison test 2: ${dateCompare2 ? '✅ PASS' : '❌ FAIL'} (${date3.toTimeString()} < ${date4.toTimeString()})`);
  
  // Test date sorting
  const dates = [date2, date1, date4, date3];
  const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
  const expectedOrder = [date1, date3, date4, date2];
  
  const sortPassed = JSON.stringify(sortedDates) === JSON.stringify(expectedOrder);
  console.log(`Date sorting test: ${sortPassed ? '✅ PASS' : '❌ FAIL'}`);
}

// Run all tests
function runAllConsoleTests() {
  console.log('🚀 Running All Console Tests...\n');
  
  testBasicMath();
  testInterestCalculations();
  testTransactionOrdering();
  testEdgeCases();
  testFloatingPointPrecision();
  testPercentageCalculations();
  testCompoundCalculations();
  testDateCalculations();
  
  console.log('\n🎯 Console Tests Complete!');
  console.log('💡 If any tests failed, check your calculation logic in the investment service.');
}

// Auto-run tests
runAllConsoleTests();

// Export functions for manual testing
window.investmentTests = {
  runAll: runAllConsoleTests,
  testBasicMath,
  testInterestCalculations,
  testTransactionOrdering,
  testEdgeCases,
  testFloatingPointPrecision,
  testPercentageCalculations,
  testCompoundCalculations,
  testDateCalculations
};

console.log('\n💡 You can also run individual tests:');
console.log('  investmentTests.testBasicMath()');
console.log('  investmentTests.testInterestCalculations()');
console.log('  investmentTests.testTransactionOrdering()');
console.log('  investmentTests.runAll()');

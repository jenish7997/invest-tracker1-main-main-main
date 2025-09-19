# 🧪 Manual Testing Guide for Investment Tracker

## Quick Start Testing

### 1. **Access Testing Page**
- Navigate to: `http://localhost:4200/testing`
- Or click "Testing" in the navigation menu

### 2. **Run Automated Tests**
- Click "Run All Tests" button
- Review the results in the dashboard
- Export results if needed

---

## 🔍 **Critical Financial Logic Testing**

### **Test 1: Basic Investment Flow**
```
1. Go to "Add Investor" → Create test investor "Test User"
2. Go to "Add Money" → Add ₹10,000 for Test User
3. Go to "Transactions" → Select Test User
4. Verify: Balance shows ₹10,000
5. Go to "Balances" → Verify Test User shows ₹10,000
```

### **Test 2: Withdrawal Flow**
```
1. Go to "Withdraw" → Withdraw ₹3,000 from Test User
2. Go to "Transactions" → Select Test User
3. Verify: Balance shows ₹7,000
4. Check transaction order (withdrawal should be latest)
```

### **Test 3: Interest Calculation**
```
1. Go to "Interest Rates" → Set rate for current month (e.g., 2%)
2. Go to "Interest" → Add interest for Test User
3. Verify: Interest amount = ₹7,000 × 2% = ₹140
4. Check final balance = ₹7,140
```

### **Test 4: Transaction Chronology**
```
1. Add multiple transactions on same date:
   - 9:00 AM: Invest ₹5,000
   - 2:00 PM: Withdraw ₹1,000
   - 6:00 PM: Invest ₹2,000
2. Go to "Transactions" → Check order
3. Verify: Transactions appear in chronological order
4. Final balance should be ₹6,000
```

---

## 🧮 **Mathematical Accuracy Tests**

### **Test 5: Edge Cases**
```
✅ Zero Amount: Try adding ₹0 (should be handled gracefully)
✅ Negative Amount: Try adding -₹1000 (check behavior)
✅ Large Amount: Try adding ₹99,999,999
✅ Decimal Amount: Try adding ₹1234.56
✅ Very Small Amount: Try adding ₹0.01
```

### **Test 6: Interest Rate Calculations**
```
Test Cases:
- Principal: ₹10,000, Rate: 2% → Interest: ₹200
- Principal: ₹5,000, Rate: 1.5% → Interest: ₹75
- Principal: ₹25,000, Rate: 3% → Interest: ₹750
- Principal: ₹1,000, Rate: 0.5% → Interest: ₹5
```

### **Test 7: Complex Scenarios**
```
Scenario: Multiple transactions with interest
1. Invest: ₹50,000
2. Withdraw: ₹10,000 (Balance: ₹40,000)
3. Invest: ₹20,000 (Balance: ₹60,000)
4. Add Interest: 2% of ₹60,000 = ₹1,200
5. Final Balance: ₹61,200
```

---

## 🔄 **Transaction Management Tests**

### **Test 8: Delete Transaction**
```
1. Add a transaction (e.g., invest ₹5,000)
2. Go to "Transactions" → Select investor
3. Click delete button on the transaction
4. Confirm deletion
5. Verify: Transaction is removed from list
6. Verify: Balance is recalculated correctly
```

### **Test 9: Data Persistence**
```
1. Add several transactions
2. Refresh the page (F5)
3. Verify: All data is still there
4. Logout and login again
5. Verify: Data persists across sessions
```

---

## 📊 **Report Page Testing**

### **Test 10: Report Accuracy**
```
1. Add multiple investors with different amounts
2. Go to "Report" page
3. Verify: All investors appear in the table
4. Verify: Total principal = sum of all investments
5. Verify: Total interest = sum of all interest payments
6. Verify: Charts display correctly
```

---

## 🚨 **Error Handling Tests**

### **Test 11: Invalid Inputs**
```
❌ Empty forms: Try submitting without filling required fields
❌ Invalid amounts: Try entering text in amount fields
❌ Future dates: Try adding transactions with future dates
❌ Negative amounts: Try withdrawing more than available balance
```

### **Test 12: Network Issues**
```
1. Disconnect internet
2. Try adding a transaction
3. Verify: Appropriate error message
4. Reconnect internet
5. Verify: App recovers gracefully
```

---

## 📱 **Cross-Browser Testing**

### **Test 13: Browser Compatibility**
```
Test on:
✅ Chrome (latest)
✅ Firefox (latest)
✅ Safari (if on Mac)
✅ Edge (latest)
✅ Mobile browsers
```

---

## ⚡ **Performance Testing**

### **Test 14: Large Data Sets**
```
1. Add 100+ transactions for one investor
2. Check page load time
3. Verify: All transactions display correctly
4. Check: Report page loads within 3 seconds
```

---

## 🎯 **Quick Testing Checklist**

### **Daily Testing (5 minutes)**
- [ ] Login works
- [ ] Add investor works
- [ ] Add money works
- [ ] Withdraw works
- [ ] Delete transaction works
- [ ] Report page loads
- [ ] All calculations are accurate

### **Weekly Testing (15 minutes)**
- [ ] Test all edge cases
- [ ] Test with multiple investors
- [ ] Test interest calculations
- [ ] Test data persistence
- [ ] Test error handling

### **Monthly Testing (30 minutes)**
- [ ] Full regression testing
- [ ] Cross-browser testing
- [ ] Performance testing
- [ ] Security testing
- [ ] Backup and restore testing

---

## 🛠️ **Debugging Tools**

### **Browser Console (F12)**
```javascript
// Check for JavaScript errors
console.log('Testing investment service...');

// Test service methods
investmentService.listInvestors().subscribe(data => {
  console.log('Investors:', data);
});
```

### **Network Tab**
- Monitor API calls
- Check response times
- Verify data being sent/received

### **Application Tab**
- Check local storage
- Monitor session data
- Verify authentication state

---

## 📋 **Test Results Template**

```
Date: ___________
Tester: ___________
Browser: ___________

✅ Passed Tests:
- [ ] Basic investment flow
- [ ] Withdrawal flow
- [ ] Interest calculation
- [ ] Transaction ordering
- [ ] Delete functionality
- [ ] Report accuracy

❌ Failed Tests:
- [ ] Test name: ___________
- [ ] Error: ___________
- [ ] Steps to reproduce: ___________

🔧 Issues Found:
- [ ] Issue 1: ___________
- [ ] Issue 2: ___________

📝 Notes:
___________
___________
```

---

## 🚀 **Automated Testing Commands**

```bash
# Run the application
ng serve

# Run unit tests
ng test

# Build for production
ng build --configuration production

# Check for linting errors
ng lint
```

---

## 📞 **When Tests Fail**

1. **Check browser console** for error messages
2. **Verify network connectivity** and Firebase connection
3. **Check data in Firebase console** for consistency
4. **Test with different browsers** to isolate issues
5. **Clear browser cache** and try again
6. **Check Angular build** for compilation errors

---

**Remember**: Testing is an ongoing process. Run these tests regularly to ensure your investment tracker remains reliable and accurate! 🎯

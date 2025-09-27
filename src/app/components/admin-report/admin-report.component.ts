import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvestmentService } from '../../services/investment.service';
import { AdminInterestService } from '../../services/admin-interest.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../services/logger.service';
import { Investor } from '../../models';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { Functions, httpsCallable } from '@angular/fire/functions';

interface MonthlyInterest {
  month: string;
  amount: number;
  rate: number; // Store the interest rate used
}

interface ReportData {
  investorName: string;
  transactions: any[];
  principal: number;
  totalInterest: number;
  grownCapital: number;
  monthlyInterestBreakdown: MonthlyInterest[];
  averageReturnPercentage: number;
}

@Component({
  selector: 'app-admin-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-report.component.html',
  styleUrls: ['./admin-report.component.css']
})
export class AdminReportComponent implements OnInit, OnDestroy {
  reports: ReportData[] = [];
  isAdmin: boolean = false;
  loading: boolean = true;
  error: string = '';
  isRecalculating: boolean = false;
  adminInterestRates: Map<string, number> = new Map(); // Store ADMIN rates by monthKey - ISOLATED from user rates
  private currentUser: any = null; // Store current user info
  private userSubscription?: Subscription;
  private ratesSubscription?: Subscription;
  

  constructor(
    private investmentService: InvestmentService,
    private adminInterestService: AdminInterestService,
    private authService: AuthService,
    private logger: LoggerService,
    private functions: Functions
  ) { }

  ngOnInit() {
    
    // Subscribe to admin interest rate changes (using adminRates collection)
    console.log('[ADMIN-REPORT] Subscribing to ADMIN rates from adminRates collection...');
    console.log('[ADMIN-REPORT] 🔍 AdminInterestRates map BEFORE subscription:', Array.from(this.adminInterestRates.entries()));
    
    this.ratesSubscription = this.adminInterestService.listAdminRates().subscribe({
      next: (rates) => {
        console.log('[ADMIN-REPORT] ✅ ADMIN interest rates updated from ADMINRATES collection:', rates);
        console.log('[ADMIN-REPORT] ✅ This should ONLY contain admin rates, NOT user rates!');
        console.log('[ADMIN-REPORT] ✅ Admin rates count:', rates.length);
        rates.forEach(rate => {
          console.log(`[ADMIN-REPORT] ✅ Found admin rate: ${rate.monthKey} = ${(rate.rate * 100).toFixed(2)}%`);
        });
        
        console.log('[ADMIN-REPORT] 🔍 Clearing adminInterestRates map...');
        this.adminInterestRates.clear();
        console.log('[ADMIN-REPORT] 🔍 AdminInterestRates map after clear:', Array.from(this.adminInterestRates.entries()));
        
        rates.forEach(rate => {
          this.adminInterestRates.set(rate.monthKey, rate.rate);
          console.log(`[ADMIN-REPORT] ✅ Set admin rate for ${rate.monthKey}: ${rate.rate}`);
        });
        this.logger.debug('Admin interest rates updated', this.adminInterestRates);
        
        console.log('[ADMIN-REPORT] 🔍 Final adminInterestRates map after loading:', Array.from(this.adminInterestRates.entries()));
        console.log('[ADMIN-REPORT] 🔍 AdminInterestRates map size:', this.adminInterestRates.size);
        
        // Only refresh reports if user is already loaded
        if (this.currentUser) {
          this.refreshReports();
        }
      },
      error: (error) => {
        console.error('[DEBUG] Error loading admin interest rates:', error);
        this.logger.error('Error loading admin interest rates', error);
        // Don't set error here, just log it - reports can still work without rates
        
        // Still refresh reports even if rates failed
        if (this.currentUser) {
          this.refreshReports();
        }
      }
    });

    // Subscribe to user changes
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser = user; // Store current user info
        this.isAdmin = user.isAdmin;
        this.loading = true;
        this.error = '';
        this.reports = []; // Clear existing reports to prevent duplicates
        
        // Load reports after user is authenticated
        this.refreshReports();
      } else {
        this.currentUser = null;
        this.loading = false;
        this.error = 'User not authenticated';
      }
    });
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.ratesSubscription) {
      this.ratesSubscription.unsubscribe();
    }
  }

  private refreshReports() {
    try {
      if (this.isAdmin) {
        this.loadAllInvestorsReports();
      } else {
        // For non-admin users, we need to get the current user info
        // This is a bit tricky since we're already in a user subscription
        // We'll store the current user info to use here
        if (this.currentUser) {
          this.loadUserReport(this.currentUser.uid, this.currentUser.displayName);
        } else {
          this.error = 'No current user available';
          this.loading = false;
        }
      }
    } catch (error) {
      console.error('[DEBUG] Error in refreshReports:', error);
      this.error = 'Error refreshing reports: ' + error.message;
      this.loading = false;
    }
  }




  loadAllInvestorsReports() {
    this.investmentService.listInvestors().subscribe({
      next: (investors) => {
        this.logger.debug('Investors loaded', investors);
        if (investors.length === 0) {
          this.loading = false;
          return;
        }
        
        let reportsGenerated = 0;
        let hasError = false;
        
        investors.forEach(investor => {
          this.generateReport(investor.id, investor.name).then(() => {
            reportsGenerated++;
            if (reportsGenerated === investors.length && !hasError) {
              this.loading = false;
            }
          }).catch(error => {
            hasError = true;
            console.error(`[DEBUG] Error generating report for ${investor.name}:`, error);
            this.logger.error('Error generating report for investor', error);
            this.error = 'Error loading investor data: ' + error.message;
            this.loading = false;
          });
        });
      },
      error: (error) => {
        console.error('[DEBUG] Error loading investors:', error);
        this.logger.error('Error loading investors', error);
        this.error = 'Error loading investors from database: ' + error.message;
        this.loading = false;
      }
    });
  }

  loadUserReport(userId: string, userName: string) {
    this.logger.debug('Loading user report', { userName, userId });
    this.logger.debug('Current reports count before loading', { count: this.reports.length });
    
    this.generateReport(userId, userName).then(() => {
      this.logger.debug('User report loaded', { totalReports: this.reports.length });
      this.loading = false;
    }).catch(error => {
      this.logger.error('Error generating user report', error);
      this.error = 'Error loading user data';
      this.loading = false;
    });
  }

  async generateReport(investorId: string, investorName: string): Promise<void> {
    try {
      console.log(`[ADMIN-REPORT] 🔥 generateReport called for ${investorName} (${investorId})`);
      console.log(`[ADMIN-REPORT] 🔥 Available admin rates:`, Array.from(this.adminInterestRates.entries()));
      
      if (!investorId) {
        throw new Error('Investor ID is required');
      }
      
      // Get raw transactions without any interest calculations
      const rawTransactions = await this.investmentService.getTransactionsByInvestor(investorId);
      console.log(`[ADMIN-REPORT] 🔥 Retrieved ${rawTransactions.length} raw transactions for ${investorName}:`, rawTransactions);
      
      // Calculate interest using ONLY admin rates
      const transactionsWithAdminInterest = this.calculateInterestUsingAdminRates(rawTransactions);
      console.log(`[ADMIN-REPORT] 🔥 Calculated interest using admin rates:`, transactionsWithAdminInterest);
      
      let principal = 0;
      let totalInterest = 0;
      const monthlyInterestMap = new Map<string, { amount: number; rate: number }>();

      transactionsWithAdminInterest.forEach(t => {
        console.log(`[ADMIN-REPORT] 🔥 Processing transaction: ${t.type} - ${t.amount} - ${t.date}`);
        if (t.type === 'invest' || t.type === 'deposit') {
          principal += t.amount;
        } else if (t.type === 'withdraw') {
          principal -= t.amount; // Deduct withdrawals from principal
        } else if (t.type === 'interest') {
          totalInterest += t.amount;
          
          // Extract month-year from transaction date
          const monthKey = this.getMonthKey(t.date);
          
          // Add to monthly breakdown with ADMIN rate information
          const existingData = monthlyInterestMap.get(monthKey) || { amount: 0, rate: 0 };
          const adminRate = this.adminInterestRates.get(monthKey) || 0;
          
          console.log(`[ADMIN-REPORT] 🔥 Processing interest transaction for ${monthKey}:`);
          console.log(`[ADMIN-REPORT] 🔥 Interest amount: ${t.amount}`);
          console.log(`[ADMIN-REPORT] 🔥 Admin rate for ${monthKey}: ${adminRate} (${(adminRate * 100).toFixed(2)}%)`);
          
          monthlyInterestMap.set(monthKey, { 
            amount: existingData.amount + t.amount, 
            rate: adminRate // Use ADMIN rate, not user rate
          });
          
          this.logger.debug('Interest transaction found', { amount: t.amount, month: monthKey, adminRate });
        }
      });

      // Only include months where the investor actually had interest transactions
      const monthlyInterestBreakdown: MonthlyInterest[] = [];
      
      // Only show months where there were actual interest transactions
      for (const [monthKey, data] of monthlyInterestMap.entries()) {
        if (data.amount > 0) { // Only include months with actual interest
          monthlyInterestBreakdown.push({
            month: monthKey,
            amount: data.amount,
            rate: data.rate
          });
        }
      }
      
      // Sort by month
      monthlyInterestBreakdown.sort((a, b) => a.month.localeCompare(b.month));

      // Calculate average return percentage
      const averageReturnPercentage = monthlyInterestBreakdown.length > 0 
        ? monthlyInterestBreakdown.reduce((sum, monthly) => sum + monthly.rate, 0) / monthlyInterestBreakdown.length
        : 0;

      console.log(`[ADMIN-REPORT] 🔥 Monthly interest breakdown for ${investorName}:`, monthlyInterestBreakdown);
      console.log(`[ADMIN-REPORT] 🔥 Average return percentage for ${investorName}:`, averageReturnPercentage);
      console.log(`[ADMIN-REPORT] 🔥 Available admin interest rates:`, Array.from(this.adminInterestRates.entries()));

      const grownCapital = transactionsWithAdminInterest.length > 0 ? transactionsWithAdminInterest[transactionsWithAdminInterest.length - 1].balance : 0;

      console.log(`[ADMIN-REPORT] 🔥 Report data for ${investorName}:`, {
        principal,
        totalInterest,
        grownCapital,
        transactionCount: transactionsWithAdminInterest.length,
        monthlyInterestBreakdown: monthlyInterestBreakdown.length
      });

      // Check if report for this investor already exists to prevent duplicates
      const existingReportIndex = this.reports.findIndex(r => r.investorName === investorName);
      const newReport = {
        investorName: investorName,
        transactions: transactionsWithAdminInterest, // Use admin interest transactions
        principal: principal,
        totalInterest: totalInterest,
        grownCapital: grownCapital,
        monthlyInterestBreakdown: monthlyInterestBreakdown,
        averageReturnPercentage: averageReturnPercentage
      };

      if (existingReportIndex >= 0) {
        // Replace existing report
        this.reports[existingReportIndex] = newReport;
        console.log(`[ADMIN-REPORT] 🔥 Updated existing report for ${investorName}. Total reports: ${this.reports.length}`);
        this.logger.debug('Updated existing report', { investorName });
      } else {
        // Add new report
        this.reports.push(newReport);
        console.log(`[ADMIN-REPORT] 🔥 Added new report for ${investorName}. Total reports: ${this.reports.length}`);
        this.logger.debug('Added new report', { investorName });
      }
    } catch (error) {
      this.logger.error('Error in generateReport', error);
      throw error;
    }
  }

  // Method to calculate interest using ONLY admin rates
  private calculateInterestUsingAdminRates(rawTransactions: any[]): any[] {
    console.log(`[ADMIN-REPORT] 🔥 Calculating interest using admin rates for ${rawTransactions.length} transactions`);
    
    // Filter out existing interest transactions to avoid duplicates
    const nonInterestTransactions = rawTransactions.filter(t => t.type !== 'interest');
    console.log(`[ADMIN-REPORT] 🔥 Filtered to ${nonInterestTransactions.length} non-interest transactions`);
    
    if (nonInterestTransactions.length === 0) {
      console.log(`[ADMIN-REPORT] 🔥 No non-interest transactions found, returning empty array`);
      return [];
    }
    
    const transactions = [...nonInterestTransactions]; // Create a copy
    const transactionsWithInterest = [];
    
    // Process transactions chronologically and add interest at month end
    let runningBalance = 0; // Track running balance including interest
    const allTransactions = [...transactions]; // Start with non-interest transactions
    const adminRateMonths = Array.from(this.adminInterestRates.keys()).sort();
    
    // Sort all transactions by date
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Process each month
    for (const monthKey of adminRateMonths) {
      const adminRate = this.adminInterestRates.get(monthKey) || 0;
      
      if (adminRate <= 0) {
        continue; // Skip months with no interest rate
      }
      
      // Parse month key (format: YYYY-MM)
      const [year, month] = monthKey.split('-').map(Number);
      const monthStartDate = new Date(year, month - 1, 1); // month is 0-indexed
      const monthEndDate = new Date(year, month, 0); // Last day of the month
      
      // Process all transactions in this month
      for (const t of allTransactions) {
        const transactionDate = new Date(t.date);
        
        if (transactionDate >= monthStartDate && transactionDate <= monthEndDate) {
          if (t.type === 'invest' || t.type === 'deposit') {
            runningBalance += t.amount;
            transactionsWithInterest.push({ ...t, balance: runningBalance });
          } else if (t.type === 'withdraw') {
            runningBalance -= t.amount;
            transactionsWithInterest.push({ ...t, balance: runningBalance });
          }
        }
      }
      
      // Add interest at the end of the month if there's a positive balance
      if (runningBalance > 0) {
        const interestAmount = runningBalance * adminRate;
        runningBalance += interestAmount; // Add interest to running balance
        
        console.log(`[ADMIN-REPORT] 🔥 Adding compound interest for ${monthKey}:`);
        console.log(`[ADMIN-REPORT] 🔥 Balance before interest: ${runningBalance - interestAmount}`);
        console.log(`[ADMIN-REPORT] 🔥 Admin rate: ${adminRate} (${(adminRate * 100).toFixed(2)}%)`);
        console.log(`[ADMIN-REPORT] 🔥 Calculated interest: ${interestAmount}`);
        console.log(`[ADMIN-REPORT] 🔥 Balance after interest: ${runningBalance}`);
        
        // Create interest transaction for the last day of the month
        const interestTransaction = {
          id: `admin_interest_${monthKey}`,
          investorId: transactions[0]?.investorId || '',
          investorName: transactions[0]?.investorName || '',
          date: monthEndDate,
          type: 'interest',
          amount: interestAmount,
          balance: runningBalance, // Balance after adding interest
          description: `Interest (${(adminRate * 100).toFixed(1)}%)`
        };
        
        transactionsWithInterest.push(interestTransaction);
      } else {
        console.log(`[ADMIN-REPORT] 🔥 No interest for ${monthKey} - balance was ${runningBalance}`);
      }
    }
    
    // Sort all transactions by date
    transactionsWithInterest.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    console.log(`[ADMIN-REPORT] 🔥 Final transactions with admin interest:`, transactionsWithInterest);
    return transactionsWithInterest;
  }

  private getMonthKey(date: Date | string): string {
    try {
      let dateObj: Date;
      
      if (typeof date === 'string') {
        if (date.includes('/')) {
          // Handle DD/MM/YYYY format
          const parts = date.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Month is 0-indexed
            const year = parseInt(parts[2]);
            dateObj = new Date(year, month, day);
          } else {
            dateObj = new Date(date);
          }
        } else {
          dateObj = new Date(date);
        }
      } else {
        dateObj = date;
      }

      // Validate the date
      if (isNaN(dateObj.getTime())) {
        this.logger.error('Invalid date in getMonthKey', { date });
        return 'invalid';
      }

      const year = dateObj.getFullYear();
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      return `${year}-${month}`;
    } catch (error) {
      this.logger.error('Error in getMonthKey', { date, error });
      return 'invalid';
    }
  }


  formatMonthDisplay(monthKey: string): string {
    const [year, month] = monthKey.split('-');
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  getTransactionInterestRate(dateString: string | Date): string {
    try {
      const monthKey = this.getMonthKey(dateString);
      
      if (monthKey === 'invalid') {
        return 'N/A';
      }
      
      const rate = this.adminInterestRates.get(monthKey);
      
      if (rate !== undefined) {
        // Convert decimal rate to percentage (e.g., 0.15 -> 15%)
        const percentage = (rate * 100).toFixed(1);
        // console.log(`[ADMIN-REPORT] ✅ Found admin rate for ${monthKey}: ${percentage}%`);
        return `${percentage}%`;
      } else {
        // No rate set for this month - show blank
        console.log(`[ADMIN-REPORT] ❌ No admin rate set for ${monthKey} - showing blank`);
        return ''; // Show blank for months without rates
      }
    } catch (error) {
      this.logger.error('Error getting interest rate for date', { dateString, error });
      return 'N/A';
    }
  }

  // Format date to display as "01 Jan 2024"
  formatDate(date: Date | string): string {
    try {
      let dateObj: Date;
      
      if (typeof date === 'string') {
        dateObj = new Date(date);
      } else {
        dateObj = date;
      }
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      
      const day = dateObj.getDate().toString().padStart(2, '0');
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      const month = monthNames[dateObj.getMonth()];
      const year = dateObj.getFullYear();
      
      return `${day} ${month} ${year}`;
    } catch (error) {
      this.logger.error('Error formatting date', { date, error });
      return 'Invalid Date';
    }
  }





}

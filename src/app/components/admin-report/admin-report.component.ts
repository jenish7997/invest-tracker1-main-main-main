import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvestmentService } from '../../services/investment.service';
import { AdminInterestService } from '../../services/admin-interest.service';
import { UserInterestService } from '../../services/user-interest.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../services/logger.service';
import { Investor } from '../../models';
import { Subscription } from 'rxjs';
import { Functions } from '@angular/fire/functions';
import * as ExcelJS from 'exceljs';

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
  grownCapitalDifference?: number; // Difference between admin and user grown capital
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
  userInterestRates: Map<string, number> = new Map(); // Store USER rates for calculating difference
  private currentUser: any = null; // Store current user info
  private userSubscription?: Subscription;
  private ratesSubscription?: Subscription;
  private userRatesSubscription?: Subscription;
  
  // Total aggregation properties
  totalPrincipal: number = 0;
  totalInterest: number = 0;
  totalGrownCapital: number = 0;
  

  constructor(
    private investmentService: InvestmentService,
    private adminInterestService: AdminInterestService,
    private userInterestService: UserInterestService,
    private authService: AuthService,
    private logger: LoggerService,
    private functions: Functions
  ) { }

  ngOnInit() {
    // Subscribe to user interest rate changes (for calculating difference)
    this.userRatesSubscription = this.userInterestService.listUserRates().subscribe({
      next: (rates) => {
        this.userInterestRates.clear();
        rates.forEach(rate => {
          this.userInterestRates.set(rate.monthKey, rate.rate);
        });
        this.logger.debug('User interest rates updated for difference calculation', this.userInterestRates);
        
        // Refresh reports if user is already loaded
        if (this.currentUser) {
          this.refreshReports();
        }
      },
      error: (error) => {
        this.logger.error('Error loading user interest rates', error);
        // Still refresh reports even if rates failed
        if (this.currentUser) {
          this.refreshReports();
        }
      }
    });

    // Subscribe to admin interest rate changes (using adminRates collection)
    this.ratesSubscription = this.adminInterestService.listAdminRates().subscribe({
      next: (rates) => {
        this.adminInterestRates.clear();
        
        rates.forEach(rate => {
          this.adminInterestRates.set(rate.monthKey, rate.rate);
        });
        this.logger.debug('Admin interest rates updated', this.adminInterestRates);
        
        // Only refresh reports if user is already loaded
        if (this.currentUser) {
          this.refreshReports();
        }
      },
      error: (error) => {
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
        
        // Only clear reports if this is a different user or first load
        if (!this.reports || this.reports.length === 0) {
          this.reports = []; // Clear existing reports to prevent duplicates
        }
        
        this.logger.debug('User authenticated', { 
          isAdmin: this.isAdmin, 
          currentReportsCount: this.reports.length,
          userId: user.uid 
        });
        
        // Load reports after user is authenticated
        this.refreshReports();
      } else {
        this.currentUser = null;
        this.loading = false;
        this.error = 'User not authenticated';
        this.reports = []; // Clear reports when user logs out
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
    if (this.userRatesSubscription) {
      this.userRatesSubscription.unsubscribe();
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
            this.logger.error('Error generating report for investor', error);
            this.error = 'Error loading investor data: ' + error.message;
            this.loading = false;
          });
        });
      },
      error: (error) => {
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
      if (!investorId) {
        throw new Error('Investor ID is required');
      }
      
      // Get raw transactions without any interest calculations
      const rawTransactions = await this.investmentService.getTransactionsByInvestor(investorId);
      
      // Filter to only include admin fund account transactions (source === 'admin')
      const adminTransactions = rawTransactions.filter(t => t.source === 'admin');
      
      // Calculate interest using ONLY admin rates
      const transactionsWithAdminInterest = this.calculateInterestUsingAdminRates(adminTransactions);
      
      let principal = 0;
      let totalInterest = 0;
      const monthlyInterestMap = new Map<string, { amount: number; rate: number }>();

      transactionsWithAdminInterest.forEach(t => {
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
          
          monthlyInterestMap.set(monthKey, { 
            amount: existingData.amount + t.amount, 
            rate: adminRate // Use ADMIN rate, not user rate
          });
          
          this.logger.debug('Interest transaction found', { amount: t.amount, month: monthKey, adminRate });
        }
      });

      // Find the first transaction date to only show months from that date onwards
      const firstTransaction = adminTransactions
        .filter(t => t.type === 'invest' || t.type === 'deposit')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
      
      const firstTransactionMonth = firstTransaction ? this.getMonthKey(firstTransaction.date) : null;
      
      // Include months that have interest rates configured, only from first transaction onwards
      const monthlyInterestBreakdown: MonthlyInterest[] = [];
      
      // Get all months with admin rates
      const allAdminRateMonths = Array.from(this.adminInterestRates.keys()).sort();
      
      for (const monthKey of allAdminRateMonths) {
        // Skip months before the first transaction
        if (firstTransactionMonth && monthKey < firstTransactionMonth) {
          continue;
        }
        
        const adminRate = this.adminInterestRates.get(monthKey) || 0;
        
        if (adminRate > 0) {
          // Get the interest amount from map
          const data = monthlyInterestMap.get(monthKey);
          
          // Only add if there's actual data (avoid ₹0 entries)
          if (data && data.amount > 0) {
            monthlyInterestBreakdown.push({
              month: monthKey,
              amount: data.amount,
              rate: data.rate || adminRate
            });
          }
        }
      }

      // Calculate average return percentage
      const averageReturnPercentage = monthlyInterestBreakdown.length > 0 
        ? monthlyInterestBreakdown.reduce((sum, monthly) => sum + monthly.rate, 0) / monthlyInterestBreakdown.length
        : 0;

      const grownCapital = transactionsWithAdminInterest.length > 0 ? transactionsWithAdminInterest[transactionsWithAdminInterest.length - 1].balance : 0;

      // Calculate user report grown capital for difference
      const userGrownCapital = await this.calculateUserGrownCapital(investorId);
      const grownCapitalDifference = grownCapital - userGrownCapital;

      // Check if report for this investor already exists to prevent duplicates
      const existingReportIndex = this.reports.findIndex(r => r.investorName === investorName);
      const newReport = {
        investorName: investorName,
        transactions: transactionsWithAdminInterest, // Use admin interest transactions
        principal: principal,
        totalInterest: totalInterest,
        grownCapital: grownCapital,
        monthlyInterestBreakdown: monthlyInterestBreakdown,
        averageReturnPercentage: averageReturnPercentage,
        grownCapitalDifference: grownCapitalDifference
      };

      if (existingReportIndex >= 0) {
        // Replace existing report
        this.reports[existingReportIndex] = newReport;
        this.logger.debug('Updated existing report', { investorName });
      } else {
        // Add new report
        this.reports.push(newReport);
        this.logger.debug('Added new report', { investorName });
      }
      
      // Calculate totals after adding/updating report
      this.calculateTotals();
    } catch (error) {
      this.logger.error('Error in generateReport', error);
      throw error;
    }
  }
  
  private calculateTotals() {
    this.totalPrincipal = this.reports.reduce((sum, report) => sum + report.principal, 0);
    this.totalInterest = this.reports.reduce((sum, report) => sum + report.totalInterest, 0);
    this.totalGrownCapital = this.reports.reduce((sum, report) => sum + report.grownCapital, 0);
    
    this.logger.debug('Totals calculated', {
      totalPrincipal: this.totalPrincipal,
      totalInterest: this.totalInterest,
      totalGrownCapital: this.totalGrownCapital
    });
  }

  // Calculate user report grown capital for comparison
  private async calculateUserGrownCapital(investorId: string): Promise<number> {
    try {
      // Get all transactions for the investor
      const rawTransactions = await this.investmentService.getTransactionsByInvestor(investorId);
      
      // Filter to only include user fund account transactions (source !== 'admin')
      const userTransactions = rawTransactions.filter(t => t.source !== 'admin');
      
      if (userTransactions.length === 0) {
        return 0;
      }
      
      // Calculate interest using user rates
      const transactionsWithUserInterest = this.calculateInterestUsingUserRates(userTransactions);
      
      // Return the final grown capital (last transaction balance)
      return transactionsWithUserInterest.length > 0 
        ? transactionsWithUserInterest[transactionsWithUserInterest.length - 1].balance 
        : 0;
    } catch (error) {
      this.logger.error('Error calculating user grown capital', error);
      return 0;
    }
  }

  // Method to calculate interest using user rates (for difference calculation)
  private calculateInterestUsingUserRates(rawTransactions: any[]): any[] {
    // Filter out existing interest transactions to avoid duplicates
    const nonInterestTransactions = rawTransactions.filter(t => t.type !== 'interest');
    
    if (nonInterestTransactions.length === 0) {
      return [];
    }
    
    // Sort all transactions by date and then by createdAt for same-day transactions
    const sortedTransactions = [...nonInterestTransactions].sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare === 0) {
        const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdAtA - createdAtB;
      }
      return dateCompare;
    });
    
    // Find the first transaction date
    const firstTransactionDate = sortedTransactions.length > 0 ? sortedTransactions[0].date : null;
    const firstTransactionMonth = firstTransactionDate ? this.getMonthKey(firstTransactionDate) : null;
    
    const transactionsWithInterest = [];
    let runningBalance = 0;
    
    // Process all transactions chronologically
    for (const transaction of sortedTransactions) {
      if (transaction.type === 'invest' || transaction.type === 'deposit') {
        runningBalance += transaction.amount;
      } else if (transaction.type === 'withdraw') {
        runningBalance -= transaction.amount;
      }
      
      // Add the transaction with updated balance
      transactionsWithInterest.push({ 
        ...transaction, 
        balance: runningBalance 
      });
    }
    
    // Now add interest at the end of each month in chronological order
    const userRateMonths = Array.from(this.userInterestRates.keys()).sort();
    
    // Create a list to collect all interest transactions
    const interestTransactions: any[] = [];
    
    // Calculate interest for each month in chronological order
    for (const monthKey of userRateMonths) {
      // Skip months before the first transaction
      if (firstTransactionMonth && monthKey < firstTransactionMonth) {
        continue;
      }
      
      const userRate = this.userInterestRates.get(monthKey) || 0;
      
      if (userRate <= 0) {
        continue; // Skip months with no interest rate
      }
      
      const [year, month] = monthKey.split('-').map(Number);
      const monthStartDate = new Date(year, month - 1, 1);
      const monthEndDate = new Date(year, month, 0);
      
      // Find the balance at the END of this month for interest calculation
      let balanceAtMonthEnd = 0;
      
      // Reconstruct the balance by walking through all transactions in order
      // Start fresh from zero for accurate calculation
      let balance = 0;
      
      // Normalize dates for comparison (set to start of day to avoid time issues)
      const monthStartNormalized = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const monthEndNormalized = new Date(year, month, 0, 23, 59, 59, 999);
      
      // Process all non-interest transactions up to the END of this month
      // Use sortedTransactions instead of transactionsWithInterest for accurate calculation
      for (const t of sortedTransactions) {
        const transactionDate = new Date(t.date);
        // Normalize transaction date to start of day for comparison
        const transactionDateNormalized = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate(), 0, 0, 0, 0);
        
        const isLastDayOfMonth = transactionDateNormalized.getDate() === monthEndNormalized.getDate() && 
                                 transactionDateNormalized.getMonth() === monthEndNormalized.getMonth() &&
                                 transactionDateNormalized.getFullYear() === monthEndNormalized.getFullYear();
        
        // Only process transactions on or before this month's end
        if (transactionDateNormalized <= monthEndNormalized) {
          if (t.type === 'invest' || t.type === 'deposit') {
            balance += t.amount;
          } else if (t.type === 'withdraw') {
            // For the CURRENT month, exclude last-day withdrawals
            if (!(transactionDateNormalized >= monthStartNormalized && isLastDayOfMonth)) {
              balance -= t.amount;
            }
          }
        }
      }
      
      // Add interest from previous months
      for (const prevInterest of interestTransactions) {
        const interestDate = new Date(prevInterest.date);
        // Normalize interest date for comparison
        const interestDateNormalized = new Date(interestDate.getFullYear(), interestDate.getMonth(), interestDate.getDate(), 0, 0, 0, 0);
        if (interestDateNormalized <= monthEndNormalized) {
          balance += prevInterest.amount;
        }
      }
      
      // Round balance to 2 decimal places before calculating interest
      balanceAtMonthEnd = Math.round(balance * 100) / 100;
      
      // Calculate interest amount and round to 2 decimal places
      // Use exact calculation: balance × rate, then round
      const interestAmount = Math.round(balanceAtMonthEnd * userRate * 100) / 100;
      
      // Create interest transaction for the last day of the month
      // Round the balance to 2 decimal places
      const newBalance = Math.round((balanceAtMonthEnd + interestAmount) * 100) / 100;
      const interestTransaction = {
        id: `user_interest_${monthKey}`,
        investorId: sortedTransactions[0]?.investorId || '',
        investorName: sortedTransactions[0]?.investorName || '',
        date: monthEndDate,
        type: 'interest',
        amount: interestAmount,
        balance: newBalance,
        description: `Interest (${(userRate * 100).toFixed(2)}%)`
      };
      
      interestTransactions.push(interestTransaction);
      transactionsWithInterest.push(interestTransaction);
      
      // Update the balance for all subsequent non-interest transactions
      for (let i = 0; i < transactionsWithInterest.length; i++) {
        const t = transactionsWithInterest[i];
        const transactionDate = new Date(t.date);
        
        // Skip interest transactions
        if (t.type === 'interest') continue;
        
        if (transactionDate > monthEndDate) {
          // Round the updated balance to 2 decimal places
          const updatedBalance = Math.round((t.balance + interestAmount) * 100) / 100;
          transactionsWithInterest[i] = {
            ...t,
            balance: updatedBalance
          };
        }
      }
    }
    
    // Sort all transactions by date and then by createdAt for same-day transactions
    transactionsWithInterest.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare === 0) {
        const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdAtA - createdAtB;
      }
      return dateCompare;
    });
    
    return transactionsWithInterest;
  }

  // Method to calculate interest using ONLY admin rates
  private calculateInterestUsingAdminRates(rawTransactions: any[]): any[] {
    // Filter out existing interest transactions to avoid duplicates
    const nonInterestTransactions = rawTransactions.filter(t => t.type !== 'interest');
    
    if (nonInterestTransactions.length === 0) {
      return [];
    }
    
    // Sort all transactions by date and then by createdAt for same-day transactions
    const sortedTransactions = [...nonInterestTransactions].sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare === 0) {
        const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdAtA - createdAtB;
      }
      return dateCompare;
    });
    
    // Find the first transaction date
    const firstTransactionDate = sortedTransactions.length > 0 ? sortedTransactions[0].date : null;
    const firstTransactionMonth = firstTransactionDate ? this.getMonthKey(firstTransactionDate) : null;
    
    const transactionsWithInterest = [];
    let runningBalance = 0;
    
    // Process all transactions chronologically
    for (const transaction of sortedTransactions) {
      if (transaction.type === 'invest' || transaction.type === 'deposit') {
        runningBalance += transaction.amount;
      } else if (transaction.type === 'withdraw') {
        runningBalance -= transaction.amount;
      }
      
      // Add the transaction with updated balance
      transactionsWithInterest.push({ 
        ...transaction, 
        balance: runningBalance 
      });
    }
    
    // Now add interest at the end of each month in chronological order
    const adminRateMonths = Array.from(this.adminInterestRates.keys()).sort();
    
    // Create a list to collect all interest transactions
    const interestTransactions: any[] = [];
    
    // Calculate interest for each month in chronological order
    for (const monthKey of adminRateMonths) {
      // Skip months before the first transaction
      if (firstTransactionMonth && monthKey < firstTransactionMonth) {
        continue;
      }
      
      const adminRate = this.adminInterestRates.get(monthKey) || 0;
      
      if (adminRate <= 0) {
        continue;
      }
      
      const [year, month] = monthKey.split('-').map(Number);
      const monthStartDate = new Date(year, month - 1, 1);
      const monthEndDate = new Date(year, month, 0);
      
      // Find the balance at the END of this month for interest calculation
      // We need the balance BEFORE any withdrawals on the last day of the month
      let balanceAtMonthEnd = 0;
      
      // Reconstruct the balance by walking through all transactions in order
      // Start fresh from zero for accurate calculation
      let balance = 0;
      
      // Normalize dates for comparison (set to start of day to avoid time issues)
      const monthStartNormalized = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const monthEndNormalized = new Date(year, month, 0, 23, 59, 59, 999);
      
      // Process all non-interest transactions up to the END of this month
      // (excluding last-day withdrawals when calculating the CURRENT month's interest)
      for (const t of sortedTransactions) {
        const transactionDate = new Date(t.date);
        // Normalize transaction date to start of day for comparison
        const transactionDateNormalized = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate(), 0, 0, 0, 0);
        
        const isLastDayOfMonth = transactionDateNormalized.getDate() === monthEndNormalized.getDate() && 
                                 transactionDateNormalized.getMonth() === monthEndNormalized.getMonth() &&
                                 transactionDateNormalized.getFullYear() === monthEndNormalized.getFullYear();
        
        // Only process transactions on or before this month's end
        if (transactionDateNormalized <= monthEndNormalized) {
          if (t.type === 'invest' || t.type === 'deposit') {
            balance += t.amount;
          } else if (t.type === 'withdraw') {
            // For the CURRENT month, exclude last-day withdrawals
            // For PREVIOUS months, include all withdrawals
            if (!(transactionDateNormalized >= monthStartNormalized && isLastDayOfMonth)) {
              balance -= t.amount;
            }
          }
        }
      }
      
      // Add interest from previous months (this doesn't include current month interest yet)
      for (const prevInterest of interestTransactions) {
        const interestDate = new Date(prevInterest.date);
        // Normalize interest date for comparison
        const interestDateNormalized = new Date(interestDate.getFullYear(), interestDate.getMonth(), interestDate.getDate(), 0, 0, 0, 0);
        if (interestDateNormalized <= monthEndNormalized) {
          balance += prevInterest.amount;
        }
      }
      
      // Round balance to 2 decimal places before calculating interest
      balanceAtMonthEnd = Math.round(balance * 100) / 100;
      
      // Calculate interest amount and round to 2 decimal places
      // Use exact calculation: balance × rate, then round
      const interestAmount = Math.round(balanceAtMonthEnd * adminRate * 100) / 100;
      
      // Create interest transaction for the last day of the month
      // Round the balance to 2 decimal places
      const newBalance = Math.round((balanceAtMonthEnd + interestAmount) * 100) / 100;
      const interestTransaction = {
        id: `admin_interest_${monthKey}`,
        investorId: sortedTransactions[0]?.investorId || '',
        investorName: sortedTransactions[0]?.investorName || '',
        date: monthEndDate,
        type: 'interest',
        amount: interestAmount,
        balance: newBalance,
        description: `Interest (${(adminRate * 100).toFixed(2)}%)`
      };
      
      interestTransactions.push(interestTransaction);
      transactionsWithInterest.push(interestTransaction);
      
      // Update the balance for all subsequent non-interest transactions
      for (let i = 0; i < transactionsWithInterest.length; i++) {
        const t = transactionsWithInterest[i];
        const transactionDate = new Date(t.date);
        
        // Skip interest transactions
        if (t.type === 'interest') continue;
        
        if (transactionDate > monthEndDate) {
          transactionsWithInterest[i] = {
            ...t,
            balance: t.balance + interestAmount
          };
        }
      }
    }
    
    // Sort all transactions by date and then by createdAt for same-day transactions
    transactionsWithInterest.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare === 0) {
        const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdAtA - createdAtB;
      }
      return dateCompare;
    });
    
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
        // Convert decimal rate to percentage (e.g., 0.15 -> 15.00%)
        const percentage = (rate * 100).toFixed(2);
        return `${percentage}%`;
      } else {
        // No rate set for this month - show blank
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


  // Export report as Excel
  async exportAsExcel() {
    try {
      // Check if reports are still loading
      if (this.loading) {
        alert('Reports are still loading. Please wait and try again.');
        return;
      }

      // Check if we have any reports
      if (!this.reports || this.reports.length === 0) {
        alert('No report data available. Please wait for reports to load and try again.');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      
      // Create a sheet for each investor
      this.reports.forEach((report, index) => {
        const sheetName = `${index + 1}. ${report.investorName.substring(0, 25).replace(/[:\\/?*\[\]]/g, '')}`;
        const worksheet = workbook.addWorksheet(sheetName);
        
        // Set column widths
        worksheet.columns = [
          { width: 12 }, // Date
          { width: 18 }, // Transaction Type
          { width: 18 }, // Principal Amount
          { width: 18 }, // Interest Amount
          { width: 18 }, // Withdrawal Amount
          { width: 20 }  // Running Balance
        ];
        
        // Add header data
        worksheet.addRow(['ADMIN INVESTMENT REPORT']);
        worksheet.addRow(['Investor Name', report.investorName]);
        worksheet.addRow(['Report Generated', new Date().toLocaleDateString()]);
        worksheet.addRow([]);
        worksheet.addRow(['FINANCIAL SUMMARY']);
        worksheet.addRow(['Principal Amount', report.principal, '₹']);
        worksheet.addRow(['Total Interest Earned', report.totalInterest, '₹']);
        worksheet.addRow(['Current Grown Capital', report.grownCapital, '₹']);
        worksheet.addRow(['Average Return Rate', (report.averageReturnPercentage * 100).toFixed(2) + '%']);
        worksheet.addRow([]);
        worksheet.addRow(['TRANSACTION HISTORY']);
        worksheet.addRow(['Date', 'Transaction Type', 'Principal Amount', 'Interest Amount', 'Withdrawal Amount', 'Running Balance']);

        // Add transaction data
        report.transactions.forEach(t => {
          const principalAmount = (t.type === 'invest' || t.type === 'deposit') ? t.amount : '';
          const interestAmount = t.type === 'interest' ? t.amount : '';
          const withdrawalAmount = t.type === 'withdraw' ? t.amount : '';
          
          worksheet.addRow([
            this.formatDate(t.date),
            t.type.toUpperCase(),
            principalAmount ? '₹' + principalAmount.toLocaleString() : '',
            interestAmount ? '₹' + interestAmount.toLocaleString() : '',
            withdrawalAmount ? '₹' + withdrawalAmount.toLocaleString() : '',
            '₹' + t.balance.toLocaleString()
          ]);
        });
      });

      // Add summary sheet if we have multiple investors
      if (this.reports.length > 1) {
        const summarySheet = workbook.addWorksheet('Portfolio Summary');
        
        summarySheet.columns = [
          { width: 25 }, // Investor Name
          { width: 18 }, // Principal
          { width: 18 }, // Interest
          { width: 18 }, // Grown Capital
          { width: 12 }  // Return %
        ];
        
        summarySheet.addRow(['TOTAL PORTFOLIO SUMMARY']);
        summarySheet.addRow(['Report Generated', new Date().toLocaleDateString()]);
        summarySheet.addRow([]);
        summarySheet.addRow(['OVERALL FINANCIALS']);
        summarySheet.addRow(['Total Principal Invested', this.totalPrincipal, '₹']);
        summarySheet.addRow(['Total Interest Earned', this.totalInterest, '₹']);
        summarySheet.addRow(['Total Grown Capital', this.totalGrownCapital, '₹']);
        summarySheet.addRow([]);
        summarySheet.addRow(['INVESTOR BREAKDOWN']);
        summarySheet.addRow(['Investor Name', 'Principal Amount', 'Interest Earned', 'Grown Capital', 'Return %']);

        this.reports.forEach(report => {
          const returnPercentage = report.principal > 0 ? 
            ((report.grownCapital - report.principal) / report.principal * 100).toFixed(2) + '%' : '0%';
          
          summarySheet.addRow([
            report.investorName,
            '₹' + report.principal.toLocaleString(),
            '₹' + report.totalInterest.toLocaleString(),
            '₹' + report.grownCapital.toLocaleString(),
            returnPercentage
          ]);
        });
      }

      // Save file
      const fileName = 'Admin_Investment_Report.xlsx';
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.URL.revokeObjectURL(url);
      
      alert(`Excel exported successfully with ${this.reports.length} investors!`);
      
    } catch (error) {
      this.logger.error('Error exporting Excel', error);
      alert('Error exporting Excel. Please try again.');
    }
  }

}
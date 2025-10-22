import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvestmentService } from '../../services/investment.service';
import { UserInterestService } from '../../services/user-interest.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../services/logger.service';
import { Investor } from '../../models';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';

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
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.css']
})
export class ReportComponent implements OnInit, OnDestroy {
  reports: ReportData[] = [];
  isAdmin: boolean = false;
  loading: boolean = true;
  error: string = '';
  interestRates: Map<string, number> = new Map(); // Store rates by monthKey
  private currentUser: any = null; // Store current user info
  private userSubscription?: Subscription;
  private ratesSubscription?: Subscription;
  
  // Total aggregation properties
  totalPrincipal: number = 0;
  totalInterest: number = 0;
  totalGrownCapital: number = 0;

  constructor(
    private investmentService: InvestmentService,
    private userInterestService: UserInterestService,
    private authService: AuthService,
    private logger: LoggerService
  ) { }

  ngOnInit() {
    // Subscribe to user interest rate changes (using original rates collection)
    this.ratesSubscription = this.userInterestService.listUserRates().subscribe({
      next: (rates) => {
        this.interestRates.clear();
        rates.forEach(rate => {
          this.interestRates.set(rate.monthKey, rate.rate);
        });
        this.logger.debug('User interest rates updated', this.interestRates);
        
        // Only refresh reports if user is already loaded
        if (this.currentUser) {
          this.refreshReports();
        }
      },
      error: (error) => {
        this.logger.error('Error loading user interest rates', error);
        this.error = 'Error loading user interest rates. Please try refreshing the page.';
        this.loading = false;
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
    if (this.isAdmin) {
      this.loadAllInvestorsReports();
    } else {
      // For non-admin users, we need to get the current user info
      // This is a bit tricky since we're already in a user subscription
      // We'll store the current user info to use here
      if (this.currentUser) {
        this.loadUserReport(this.currentUser.uid, this.currentUser.displayName);
      }
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
        investors.forEach(investor => {
          this.generateReport(investor.id, investor.name).then(() => {
            reportsGenerated++;
            if (reportsGenerated === investors.length) {
              this.loading = false;
            }
          }).catch(error => {
            this.logger.error('Error generating report for investor', error);
            this.error = 'Error loading investor data';
            this.loading = false;
          });
        });
      },
      error: (error) => {
        this.logger.error('Error loading investors', error);
        this.error = 'Error loading investors from database';
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
      // Validate inputs
      if (!investorId || !investorName) {
        this.logger.error('Invalid investor data', { investorId, investorName });
        return;
      }
      
      // Use the same method as admin report to get raw transactions
      const rawTransactions = await this.investmentService.getTransactionsByInvestor(investorId);
      
      // Filter out existing interest transactions to prevent duplicates
      const nonInterestTransactions = rawTransactions.filter(t => t.type !== 'interest');
      
      // Recalculate interest using user rates to ensure accuracy
      const transactions = this.calculateInterestUsingUserRates(nonInterestTransactions);
      
      this.logger.logFinancialData(`Transactions for ${investorName}`, transactions);
      
      let principal = 0;
      let totalInterest = 0;
      const monthlyInterestMap = new Map<string, { amount: number; rate: number }>();

      transactions.forEach(t => {
        this.logger.debug('Processing transaction', { type: t.type, amount: t.amount, date: t.date });
        if (t?.type === 'invest' || t?.type === 'deposit') {
          principal += t.amount || 0;
        } else if (t?.type === 'withdraw') {
          principal -= t.amount || 0; // Deduct withdrawals from principal
        } else if (t?.type === 'interest') {
          totalInterest += t.amount || 0;
          
          // Extract month-year from transaction date
          const monthKey = this.getMonthKey(t.date);
          
          // Add to monthly breakdown with rate information
          const existingData = monthlyInterestMap.get(monthKey) || { amount: 0, rate: 0 };
          const rate = this.interestRates.get(monthKey) || 0;
          monthlyInterestMap.set(monthKey, { 
            amount: existingData.amount + t.amount, 
            rate: rate 
          });
          
          this.logger.debug('Interest transaction found', { amount: t.amount, month: monthKey });
        }
      });

      // Convert monthly interest map to array and sort by month
      const monthlyInterestBreakdown: MonthlyInterest[] = Array.from(monthlyInterestMap.entries())
        .map(([month, data]) => ({ month, amount: data.amount, rate: data.rate }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Calculate average return percentage
      const averageReturnPercentage = monthlyInterestBreakdown.length > 0 
        ? monthlyInterestBreakdown.reduce((sum, monthly) => sum + monthly.rate, 0) / monthlyInterestBreakdown.length
        : 0;

      const grownCapital = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

      // Check if report for this investor already exists to prevent duplicates
      const existingReportIndex = this.reports.findIndex(r => r.investorName === investorName);
      const newReport = {
        investorName: investorName,
        transactions: transactions,
        principal: principal,
        totalInterest: totalInterest,
        grownCapital: grownCapital,
        monthlyInterestBreakdown: monthlyInterestBreakdown,
        averageReturnPercentage: averageReturnPercentage
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
      
      const rate = this.interestRates.get(monthKey);
      
      if (rate !== undefined) {
        // Convert decimal rate to percentage (e.g., 0.15 -> 15%)
        const percentage = (rate * 100).toFixed(1);
        return `${percentage}%`;
      } else {
        this.logger.warn('No interest rate found for month', { monthKey });
        return 'N/A';
      }
    } catch (error) {
      this.logger.error('Error getting interest rate for date', { dateString, error });
      return 'N/A';
    }
  }


  // Calculate interest using user rates to prevent duplicates
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
    
    // Now add interest at the end of each month where there's a positive balance
    const userRateMonths = Array.from(this.interestRates.keys()).sort();
    
    for (const monthKey of userRateMonths) {
      const userRate = this.interestRates.get(monthKey) || 0;
      
      if (userRate <= 0) {
        continue; // Skip months with no interest rate
      }
      
      // Parse month key (format: YYYY-MM)
      const [year, month] = monthKey.split('-').map(Number);
      const monthStartDate = new Date(year, month - 1, 1); // month is 0-indexed
      const monthEndDate = new Date(year, month, 0); // Last day of the month
      
      // Find the balance at the end of this month (after all transactions in the month)
      let balanceAtMonthEnd = 0;
      let hasTransactionsInMonth = false;
      
      // Look through all transactions to find the balance at the end of this month
      // We need to find the last transaction in this month to get the correct balance
      for (const t of transactionsWithInterest) {
        const transactionDate = new Date(t.date);
        
        if (transactionDate >= monthStartDate && transactionDate <= monthEndDate) {
          balanceAtMonthEnd = t.balance;
          hasTransactionsInMonth = true;
        }
      }
      
      // If there were transactions in this month and we have a positive balance, add interest
      if (hasTransactionsInMonth && balanceAtMonthEnd > 0) {
        const interestAmount = balanceAtMonthEnd * userRate;
        
        // Create interest transaction for the last day of the month
        const interestTransaction = {
          id: `user_interest_${monthKey}`,
          investorId: sortedTransactions[0]?.investorId || '',
          investorName: sortedTransactions[0]?.investorName || '',
          date: monthEndDate,
          type: 'interest',
          amount: interestAmount,
          balance: balanceAtMonthEnd + interestAmount, // Balance after adding interest
          description: `Interest (${(userRate * 100).toFixed(1)}%)`
        };
        
        transactionsWithInterest.push(interestTransaction);
        
        // Update the balance for all subsequent transactions
        // We need to update the balance for all transactions that come after this month
        for (let i = 0; i < transactionsWithInterest.length; i++) {
          const t = transactionsWithInterest[i];
          const transactionDate = new Date(t.date);
          
          // If this transaction is after the current month, add the interest to its balance
          if (transactionDate > monthEndDate) {
            transactionsWithInterest[i] = {
              ...t,
              balance: t.balance + interestAmount
            };
          }
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
  exportAsExcel() {
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

      const wb = XLSX.utils.book_new();
      
      // Create a sheet for each investor
      this.reports.forEach((report, index) => {
        // Prepare data for this investor
        const investorData = [
          ['INVESTMENT REPORT'],
          ['Investor Name', report.investorName],
          ['Report Generated', new Date().toLocaleDateString()],
          [],
          ['FINANCIAL SUMMARY'],
          ['Principal Amount', report.principal, '₹'],
          ['Total Interest Earned', report.totalInterest, '₹'],
          ['Current Grown Capital', report.grownCapital, '₹'],
          ['Average Return Rate', (report.averageReturnPercentage * 100).toFixed(2) + '%'],
          [],
          ['TRANSACTION HISTORY'],
          ['Date', 'Transaction Type', 'Principal Amount', 'Interest Amount', 'Withdrawal Amount', 'Running Balance']
        ];

        // Add transaction data
        report.transactions.forEach(t => {
          const principalAmount = (t.type === 'invest' || t.type === 'deposit') ? t.amount : '';
          const interestAmount = t.type === 'interest' ? t.amount : '';
          const withdrawalAmount = t.type === 'withdraw' ? t.amount : '';
          
          investorData.push([
            this.formatDate(t.date),
            t.type.toUpperCase(),
            principalAmount ? '₹' + principalAmount.toLocaleString() : '',
            interestAmount ? '₹' + interestAmount.toLocaleString() : '',
            withdrawalAmount ? '₹' + withdrawalAmount.toLocaleString() : '',
            '₹' + t.balance.toLocaleString()
          ]);
        });

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(investorData);
        
        // Set column widths
        ws['!cols'] = [
          { wch: 12 }, // Date
          { wch: 18 }, // Transaction Type
          { wch: 18 }, // Principal Amount
          { wch: 18 }, // Interest Amount
          { wch: 18 }, // Withdrawal Amount
          { wch: 20 }  // Running Balance
        ];

        // Add sheet to workbook
        const sheetName = `${index + 1}. ${report.investorName.substring(0, 25).replace(/[:\\/?*\[\]]/g, '')}`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      // Add summary sheet if admin and we have multiple investors
      if (this.isAdmin && this.reports.length > 1) {
        const summaryData = [
          ['TOTAL PORTFOLIO SUMMARY'],
          ['Report Generated', new Date().toLocaleDateString()],
          [],
          ['OVERALL FINANCIALS'],
          ['Total Principal Invested', this.totalPrincipal, '₹'],
          ['Total Interest Earned', this.totalInterest, '₹'],
          ['Total Grown Capital', this.totalGrownCapital, '₹'],
          [],
          ['INVESTOR BREAKDOWN'],
          ['Investor Name', 'Principal Amount', 'Interest Earned', 'Grown Capital', 'Return %']
        ];

        this.reports.forEach(report => {
          const returnPercentage = report.principal > 0 ? 
            ((report.grownCapital - report.principal) / report.principal * 100).toFixed(2) + '%' : '0%';
          
          summaryData.push([
            report.investorName,
            '₹' + report.principal.toLocaleString(),
            '₹' + report.totalInterest.toLocaleString(),
            '₹' + report.grownCapital.toLocaleString(),
            returnPercentage
          ]);
        });

        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        summaryWs['!cols'] = [
          { wch: 25 }, // Investor Name
          { wch: 18 }, // Principal
          { wch: 18 }, // Interest
          { wch: 18 }, // Grown Capital
          { wch: 12 }  // Return %
        ];

        XLSX.utils.book_append_sheet(wb, summaryWs, 'Portfolio Summary');
      }

      // Save file
      const fileName = this.isAdmin ? 'All_Investors_Report.xlsx' : 'My_Investment_Report.xlsx';
      XLSX.writeFile(wb, fileName);
      
      alert(`Excel exported successfully with ${this.reports.length} investors!`);
      
    } catch (error) {
      this.logger.error('Error exporting Excel', error);
      alert('Error exporting Excel. Please try again.');
    }
  }

}
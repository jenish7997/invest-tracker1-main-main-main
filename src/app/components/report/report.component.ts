
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvestmentService } from '../../services/investment.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../services/logger.service';
import { Investor } from '../../models';
import { Subscription } from 'rxjs';

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

  constructor(
    private investmentService: InvestmentService,
    private authService: AuthService,
    private logger: LoggerService
  ) { }

  ngOnInit() {
    console.log('[DEBUG] Report component ngOnInit called');
    
    // Subscribe to interest rate changes
    this.ratesSubscription = this.investmentService.listRates().subscribe({
      next: (rates) => {
        console.log('[DEBUG] Interest rates updated:', rates);
        this.interestRates.clear();
        rates.forEach(rate => {
          this.interestRates.set(rate.monthKey, rate.rate);
        });
        this.logger.debug('Interest rates updated', this.interestRates);
        
        // Only refresh reports if user is already loaded
        if (this.currentUser) {
          console.log('[DEBUG] Refreshing reports due to rate change');
          this.refreshReports();
        }
      },
      error: (error) => {
        console.error('[DEBUG] Error loading interest rates:', error);
        this.logger.error('Error loading interest rates', error);
        this.error = 'Error loading interest rates';
        this.loading = false;
      }
    });

    // Subscribe to user changes
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      console.log('[DEBUG] User state changed:', user);
      if (user) {
        this.currentUser = user; // Store current user info
        this.isAdmin = user.isAdmin;
        this.loading = true;
        this.error = '';
        this.reports = []; // Clear existing reports to prevent duplicates
        
        console.log('[DEBUG] User authenticated, loading reports. isAdmin:', this.isAdmin);
        // Load reports after user is authenticated
        this.refreshReports();
      } else {
        this.currentUser = null;
        this.loading = false;
        this.error = 'User not authenticated';
        console.log('[DEBUG] User not authenticated');
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
    console.log('[DEBUG] refreshReports called. isAdmin:', this.isAdmin, 'currentUser:', this.currentUser);
    if (this.isAdmin) {
      console.log('[DEBUG] Loading all investors reports');
      this.loadAllInvestorsReports();
    } else {
      // For non-admin users, we need to get the current user info
      // This is a bit tricky since we're already in a user subscription
      // We'll store the current user info to use here
      if (this.currentUser) {
        console.log('[DEBUG] Loading user report for:', this.currentUser.displayName);
        this.loadUserReport(this.currentUser.uid, this.currentUser.displayName);
      } else {
        console.log('[DEBUG] No current user, cannot load reports');
      }
    }
  }

  // Public method to manually refresh reports (useful for debugging)
  public refreshReportsManually() {
    this.logger.debug('Manually refreshing reports...');
    this.refreshReports();
  }


  loadAllInvestorsReports() {
    console.log('[DEBUG] loadAllInvestorsReports called');
    this.investmentService.listInvestors().subscribe({
      next: (investors) => {
        console.log('[DEBUG] Investors loaded:', investors);
        this.logger.debug('Investors loaded', investors);
        if (investors.length === 0) {
          this.loading = false;
          return;
        }
        
        let reportsGenerated = 0;
        investors.forEach(investor => {
          console.log(`[DEBUG] Generating report for investor: ${investor.name} (${investor.id})`);
          this.generateReport(investor.id, investor.name).then(() => {
            reportsGenerated++;
            console.log(`[DEBUG] Report generated for ${investor.name}. Total: ${reportsGenerated}/${investors.length}`);
            if (reportsGenerated === investors.length) {
              console.log('[DEBUG] All reports generated. Setting loading to false.');
              this.loading = false;
            }
          }).catch(error => {
            console.error(`[DEBUG] Error generating report for ${investor.name}:`, error);
            this.logger.error('Error generating report for investor', error);
            this.error = 'Error loading investor data';
            this.loading = false;
          });
        });
      },
      error: (error) => {
        console.error('[DEBUG] Error loading investors:', error);
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
      console.log(`[DEBUG] generateReport called for ${investorName} (${investorId})`);
      const transactions = await this.investmentService.computeBalances(investorId);
      console.log(`[DEBUG] Retrieved ${transactions.length} transactions for ${investorName}:`, transactions);
      this.logger.logFinancialData(`Transactions for ${investorName}`, transactions);
      
      let principal = 0;
      let totalInterest = 0;
      const monthlyInterestMap = new Map<string, { amount: number; rate: number }>();

      transactions.forEach(t => {
        this.logger.debug('Processing transaction', { type: t.type, amount: t.amount, date: t.date });
        if (t.type === 'invest' || t.type === 'deposit') {
          principal += t.amount;
        } else if (t.type === 'interest') {
          totalInterest += t.amount;
          
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

      console.log(`[DEBUG] Monthly interest breakdown for ${investorName}:`, monthlyInterestBreakdown);
      console.log(`[DEBUG] Average return percentage for ${investorName}:`, averageReturnPercentage);
      console.log(`[DEBUG] Available interest rates:`, Array.from(this.interestRates.entries()));

      const grownCapital = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

      console.log(`[DEBUG] Report data for ${investorName}:`, {
        principal,
        totalInterest,
        grownCapital,
        transactionCount: transactions.length,
        monthlyInterestBreakdown: monthlyInterestBreakdown.length
      });

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
        console.log(`[DEBUG] Updated existing report for ${investorName}. Total reports: ${this.reports.length}`);
        this.logger.debug('Updated existing report', { investorName });
      } else {
        // Add new report
        this.reports.push(newReport);
        console.log(`[DEBUG] Added new report for ${investorName}. Total reports: ${this.reports.length}`);
        this.logger.debug('Added new report', { investorName });
      }
    } catch (error) {
      this.logger.error('Error in generateReport', error);
      throw error;
    }
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

}

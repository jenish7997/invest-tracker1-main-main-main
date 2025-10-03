import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvestmentService } from '../../services/investment.service';
import { AdminInterestService } from '../../services/admin-interest.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../services/logger.service';
import { Investor } from '../../models';
import { Subscription } from 'rxjs';
import { Functions } from '@angular/fire/functions';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  
  // Total aggregation properties
  totalPrincipal: number = 0;
  totalInterest: number = 0;
  totalGrownCapital: number = 0;
  

  constructor(
    private investmentService: InvestmentService,
    private adminInterestService: AdminInterestService,
    private authService: AuthService,
    private logger: LoggerService,
    private functions: Functions
  ) { }

  ngOnInit() {
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
      
      // Calculate interest using ONLY admin rates
      const transactionsWithAdminInterest = this.calculateInterestUsingAdminRates(rawTransactions);
      
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

      const grownCapital = transactionsWithAdminInterest.length > 0 ? transactionsWithAdminInterest[transactionsWithAdminInterest.length - 1].balance : 0;

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

  // Method to calculate interest using ONLY admin rates
  private calculateInterestUsingAdminRates(rawTransactions: any[]): any[] {
    // Filter out existing interest transactions to avoid duplicates
    const nonInterestTransactions = rawTransactions.filter(t => t.type !== 'interest');
    
    if (nonInterestTransactions.length === 0) {
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
      }
    }
    
    // Sort all transactions by date
    transactionsWithInterest.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
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

  // Export report as PDF
  async exportAsPDF() {
    try {
      const element = document.querySelector('.report-container') as HTMLElement;
      if (!element) {
        this.logger.error('Report container not found');
        return;
      }

      // Hide export buttons temporarily
      const buttons = document.querySelectorAll('.export-btn');
      buttons.forEach(btn => (btn as HTMLElement).style.display = 'none');

      const canvas = await html2canvas(element, {
        scale: 1, // Reduced scale to decrease file size
        useCORS: true,
        logging: false,
        backgroundColor: '#f8f9fa', // Match your website background
        removeContainer: true,
        allowTaint: true,
        foreignObjectRendering: true,
        imageTimeout: 15000
      });

      // Show buttons again
      buttons.forEach(btn => (btn as HTMLElement).style.display = '');

      // Convert to PNG with better quality to preserve colors
      const imgData = canvas.toDataURL('image/png', 1.0); // Full quality to preserve colors
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = 'Admin_Investment_Report.pdf';
      pdf.save(fileName);
      
      this.logger.debug('PDF exported successfully');
    } catch (error) {
      this.logger.error('Error exporting PDF', error);
      alert('Error exporting PDF. Please try again.');
    }
  }

  // Export report as Excel
  exportAsExcel() {
    try {
      const wb = XLSX.utils.book_new();
      
      this.logger.debug('Starting Excel export', { totalReports: this.reports.length });

      // Export each investor's report as a separate sheet
      this.reports.forEach((report, index) => {
        this.logger.debug('Processing report', { index, investorName: report.investorName });
        // Prepare summary data with better formatting
        const summaryData = [
          ['ADMIN INVESTMENT REPORT'],
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

        // Add transaction data with better formatting
        report.transactions.forEach(t => {
          const principalAmount = (t.type === 'invest' || t.type === 'deposit') ? t.amount : '';
          const interestAmount = t.type === 'interest' ? t.amount : '';
          const withdrawalAmount = t.type === 'withdraw' ? t.amount : '';
          
          summaryData.push([
            this.formatDate(t.date),
            t.type.toUpperCase(),
            principalAmount ? '₹' + principalAmount.toLocaleString() : '',
            interestAmount ? '₹' + interestAmount.toLocaleString() : '',
            withdrawalAmount ? '₹' + withdrawalAmount.toLocaleString() : '',
            '₹' + t.balance.toLocaleString()
          ]);
        });

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        
        // Set column widths for better readability
        ws['!cols'] = [
          { wch: 12 }, // Date
          { wch: 18 }, // Transaction Type
          { wch: 18 }, // Principal Amount
          { wch: 18 }, // Interest Amount
          { wch: 18 }, // Withdrawal Amount
          { wch: 20 }  // Running Balance
        ];

        // Add borders and formatting
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellAddress]) ws[cellAddress] = { v: '' };
            
            // Header row styling
            if (R === 0 || R === 4 || R === 10) {
              ws[cellAddress].s = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '1a237e' } },
                alignment: { horizontal: 'center' }
              };
            }
            // Financial summary rows
            else if (R >= 5 && R <= 8) {
              ws[cellAddress].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: 'f0f8ff' } }
              };
            }
            // Transaction header
            else if (R === 10) {
              ws[cellAddress].s = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '2e7d32' } },
                alignment: { horizontal: 'center' }
              };
            }
            // Transaction data rows
            else if (R > 10) {
              ws[cellAddress].s = {
                fill: { fgColor: { rgb: 'fafafa' } },
                alignment: { horizontal: 'right' }
              };
            }
          }
        }

        // Add sheet to workbook (sanitize sheet name)
        const sheetName = `${index + 1}. ${report.investorName.substring(0, 25).replace(/[:\\/?*\[\]]/g, '')}`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      // Add summary sheet
      if (this.reports.length > 1) {
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

        // Format summary sheet
        const range = XLSX.utils.decode_range(summaryWs['!ref'] || 'A1:A1');
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!summaryWs[cellAddress]) summaryWs[cellAddress] = { v: '' };
            
            if (R === 0 || R === 3 || R === 8) {
              summaryWs[cellAddress].s = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '1a237e' } },
                alignment: { horizontal: 'center' }
              };
            } else if (R >= 4 && R <= 6) {
              summaryWs[cellAddress].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: 'e8f5e8' } }
              };
            } else if (R > 8) {
              summaryWs[cellAddress].s = {
                fill: { fgColor: { rgb: 'f0f8ff' } },
                alignment: { horizontal: 'right' }
              };
            }
          }
        }

        XLSX.utils.book_append_sheet(wb, summaryWs, 'Portfolio Summary');
      }

      // Save file
      const fileName = 'Admin_Investment_Report.xlsx';
      XLSX.writeFile(wb, fileName);
      
      this.logger.debug('Excel exported successfully');
    } catch (error) {
      this.logger.error('Error exporting Excel', error);
      alert('Error exporting Excel. Please try again.');
    }
  }

}
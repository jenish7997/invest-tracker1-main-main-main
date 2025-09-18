import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InvestmentService } from '../../services/investment.service';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { Investor, Transaction } from '../../models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  investors: Investor[] = [];
  transactions: Transaction[] = [];
  isDeleting = false;
  isRecalculating = false;
  isInitializingRates = false;

  constructor(
    private svc: InvestmentService,
    private authService: AuthService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.loadInvestors();
  }

  loadInvestors(): void {
    console.log('[DEBUG] loadInvestors called');
    this.svc.listInvestors().subscribe(data => {
      console.log('[DEBUG] Investors loaded in admin:', data);
      this.investors = data;
    });
  }

  async recalculateInterestForInvestor(investorId: string, investorName: string): Promise<void> {
    if (this.isRecalculating) return;
    
    const confirmed = confirm(
      `Recalculate interest for ${investorName}?\n\n` +
      `This will:\n` +
      `• Remove all existing interest transactions\n` +
      `• Recalculate interest based on current investments and rates\n` +
      `• Update the investor's balance\n\n` +
      `This ensures accurate interest calculation after new investments.`
    );
    
    if (!confirmed) return;
    
    this.isRecalculating = true;
    
    try {
      const success = await this.adminService.recalculateInterestForInvestor(investorId);
      if (success) {
        // Refresh the investors list after recalculation
        this.loadInvestors();
      }
    } catch (error) {
      console.error('Error recalculating interest:', error);
    } finally {
      this.isRecalculating = false;
    }
  }

  async deleteInvestor(investorId: string, investorName: string): Promise<void> {
    if (this.isDeleting) return;
    
    const confirmed = confirm(
      `Are you sure you want to delete ${investorName}?\n\n` +
      `This will permanently delete:\n` +
      `• The investor's account from Firebase Auth\n` +
      `• All their transaction history\n` +
      `• All their balance data\n\n` +
      `This action cannot be undone!`
    );
    
    if (!confirmed) return;
    
    this.isDeleting = true;
    
    try {
      const success = await this.adminService.deleteInvestor(investorId);
      if (success) {
        // Refresh the investors list after deletion
        this.loadInvestors();
      }
    } catch (error) {
      console.error('Error deleting investor:', error);
    } finally {
      this.isDeleting = false;
    }
  }

  async initializeSampleRates(): Promise<void> {
    const confirmed = confirm(
      `Initialize sample interest rates?\n\n` +
      `This will add sample rates for the current year to help you test the interest page.\n` +
      `The rates will be:\n` +
      `• January: 10%\n` +
      `• February: 12%\n` +
      `• March: 8%\n` +
      `• April: 15%\n` +
      `• May: 9%\n` +
      `• June: 11%\n\n` +
      `You can edit these rates later from the Interest page.`
    );
    
    if (!confirmed) return;

    this.isInitializingRates = true;
    try {
      const success = await this.adminService.initializeSampleRates();
      if (success) {
        alert('Sample interest rates initialized successfully! You can now use the Interest page.');
      } else {
        alert('Failed to initialize sample rates. Please try again.');
      }
    } catch (error) {
      console.error('Error initializing sample rates:', error);
      alert('Error initializing sample rates. Please try again.');
    } finally {
      this.isInitializingRates = false;
    }
  }

  onLogout(): void {
    this.authService.logout();
  }
}

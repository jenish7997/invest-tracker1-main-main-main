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
  isApplyingInterest = false;

  constructor(
    private svc: InvestmentService,
    private authService: AuthService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.loadInvestors();
  }

  loadInvestors(): void {
    this.svc.listInvestors().subscribe(data => {
      this.investors = data;
    });
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

  async applyHistoricalInterestToInvestor(investorId: string, investorName: string): Promise<void> {
    if (this.isApplyingInterest) return;
    
    const confirmed = confirm(
      `Apply historical interest to ${investorName}?\n\n` +
      `This will apply all available interest rates from their earliest transaction date to current month.\n` +
      `Interest that has already been applied will be skipped.`
    );
    
    if (!confirmed) return;
    
    this.isApplyingInterest = true;
    
    try {
      const success = await this.adminService.applyHistoricalInterest(investorId);
      if (success) {
        // Refresh the investors list to show updated balances
        this.loadInvestors();
      }
    } catch (error) {
      console.error('Error applying historical interest:', error);
    } finally {
      this.isApplyingInterest = false;
    }
  }


  onLogout(): void {
    this.authService.logout();
  }
}

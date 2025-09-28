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
      // Note: Investor deletion functionality has been removed
      // Investors can only be managed through Firebase Console
      console.log('Investor deletion is disabled. Please use Firebase Console to manage investors.');
      alert('Investor deletion is disabled. Please use Firebase Console to manage investors.');
    } catch (error) {
      console.error('Error deleting investor:', error);
    } finally {
      this.isDeleting = false;
    }
  }


  onLogout(): void {
    this.authService.logout();
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InvestmentService } from '../../services/investment.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../services/logger.service';
import { Investor } from '../../models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  investors: Investor[] = [];
  isDeleting = false;

  constructor(
    private svc: InvestmentService,
    private authService: AuthService,
    private logger: LoggerService
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
      `• All their transaction history\n` +
      `• All their balance data\n` +
      `• The investor record\n\n` +
      `This action cannot be undone!`
    );
    
    if (!confirmed) return;
    
    this.isDeleting = true;
    
    try {
      await this.svc.deleteInvestor(investorId);
      alert(`${investorName} has been successfully deleted.`);
      this.loadInvestors(); // Refresh the list
    } catch (error) {
      alert(`Failed to delete ${investorName}. Please try again.`);
      this.logger.error('Error deleting investor', error);
    } finally {
      this.isDeleting = false;
    }
  }


  onLogout(): void {
    this.authService.logout();
  }
}

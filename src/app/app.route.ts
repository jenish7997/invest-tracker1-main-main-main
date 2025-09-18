
import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { AdminComponent } from './components/admin/admin.component';
import { AuthGuard } from './guards/auth.guard';
import { BalancesComponent } from './components/balances/balances.component';
import { TransactionsComponent } from './components/transactions/transactions.component';
import { AddmoneyComponent } from './components/addmoney/addmoney.component';
import { WithdrawComponent } from './components/withdraw/withdraw.component';
import { InterestComponent } from './components/interest/interest.component';
import { AddInvestorComponent } from './components/add-investor/add-investor.component';
import { ReportComponent } from './components/report/report.component';
import { UserGuard } from './guards/user.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'admin', component: AdminComponent, canActivate: [AuthGuard] },
  { path: 'balances', component: BalancesComponent, canActivate: [AuthGuard] },
  { path: 'transactions', component: TransactionsComponent, canActivate: [AuthGuard] },
  { path: 'add-money', component: AddmoneyComponent, canActivate: [AuthGuard] },
  { path: 'withdraw', component: WithdrawComponent, canActivate: [AuthGuard] },
  { path: 'interest', component: InterestComponent, canActivate: [AuthGuard] },
  { path: 'add-investor', component: AddInvestorComponent, canActivate: [AuthGuard] },
  { path: 'report', component: ReportComponent, canActivate: [UserGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];

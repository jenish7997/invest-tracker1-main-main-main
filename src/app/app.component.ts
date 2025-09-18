
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Investment Tracker';
  isAdmin$: Observable<boolean>;

  constructor(public authService: AuthService, private router: Router) {
    this.isAdmin$ = this.authService.isAdmin$;
  }

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (user) {
        // User is logged in, decide where to navigate
        this.authService.isAdmin$.pipe(take(1)).subscribe(isAdmin => {
          if (isAdmin) {
            this.router.navigate(['/add-investor']);
          } else {
            this.router.navigate(['/report']);
          }
        });
      } else {
        // User is not logged in, ensure they are on the login page
        this.router.navigate(['/login']);
      }
    });
  }

  onLogout(): void {
    this.authService.logout();
  }
}

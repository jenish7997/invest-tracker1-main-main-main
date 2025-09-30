
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User, getIdTokenResult, IdTokenResult } from '@angular/fire/auth';
import { Observable, of, from, combineLatest } from 'rxjs';
import { map, switchMap, shareReplay, catchError } from 'rxjs/operators';
import { LoggerService } from './logger.service';

interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public readonly user$: Observable<User | null>;
  public readonly isAdmin$: Observable<boolean>;
  public readonly currentUser$: Observable<AppUser | null>;

  constructor(
    private auth: Auth, 
    private router: Router,
    private logger: LoggerService
  ) {
    this.user$ = authState(this.auth);

    this.isAdmin$ = this.user$.pipe(
      switchMap(user => {
        if (!user) {
          return of(false);
        }
        return from(getIdTokenResult(user, true)).pipe(
          map((tokenResult: IdTokenResult) => {
            try {
              return tokenResult.claims['admin'] === true;
            } catch (error) {
              this.logger.warn('Error reading admin claim', error);
              return false;
            }
          }),
          catchError(error => {
            this.logger.warn('Error getting ID token result', error);
            return of(false);
          })
        );
      }),
      shareReplay(1)
    );

    this.currentUser$ = combineLatest([this.user$, this.isAdmin$]).pipe(
      map(([user, isAdmin]) => {
        if (!user) {
          return null;
        }
        return {
          uid: user.uid,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          isAdmin: isAdmin
        };
      }),
      shareReplay(1)
    );
  }


  isUser(): Observable<boolean> {
    return this.user$.pipe(map(user => !!user));
  }

  isAdmin(): Observable<boolean> {
    return this.isAdmin$;
  }

  async login(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      this.logger.error('Login failed', error);
      throw error;
    }
  }

  async register(email: string, password: string): Promise<void> {
    try {
      await createUserWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      this.logger.error('Registration failed', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}

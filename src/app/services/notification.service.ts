import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private transactionAddedSubject = new BehaviorSubject<boolean>(false);
  public transactionAdded$ = this.transactionAddedSubject.asObservable();

  notifyTransactionAdded() {
    this.transactionAddedSubject.next(true);
  }

}

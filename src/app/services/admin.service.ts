
import { Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(
    private functions: Functions, 
    private snackBar: MatSnackBar,
    private logger: LoggerService
  ) {}



}

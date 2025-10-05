import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  
  private isProduction = environment.production;

  // Debug logging - removed
  debug(message: string, data?: any): void {
    // Debug logging completely removed
  }

  // Info logging - only in development
  info(message: string, data?: any): void {
    if (!this.isProduction) {
      if (data) {
        console.log(`[INFO] ${message}`, data);
      } else {
        console.log(`[INFO] ${message}`);
      }
    }
  }

  // Warning logging - always logged
  warn(message: string, error?: any): void {
    if (error) {
      console.warn(`[WARN] ${message}`, this.sanitizeError(error));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  }

  // Error logging - always logged but sanitized
  error(message: string, error?: any): void {
    if (error) {
      console.error(`[ERROR] ${message}`, this.sanitizeError(error));
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }

  // Sanitize error objects to remove sensitive data
  private sanitizeError(error: any): any {
    if (!error) return error;
    
    // If it's an Error object, return a safe version
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack
      };
    }
    
    // If it's an object, sanitize it
    if (typeof error === 'object') {
      const sanitized: any = {};
      
      // Only include safe properties
      const safeProperties = ['name', 'message', 'code', 'status'];
      for (const prop of safeProperties) {
        if (error[prop] !== undefined) {
          sanitized[prop] = error[prop];
        }
      }
      
      return sanitized;
    }
    
    // For primitive types, return as is
    return error;
  }

  // Log financial data safely - removed
  logFinancialData(context: string, data: any): void {
    // Financial data logging completely removed
  }

}

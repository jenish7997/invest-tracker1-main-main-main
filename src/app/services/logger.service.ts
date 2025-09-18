import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  
  private isProduction = environment.production;

  // Debug logging - only in development
  debug(message: string, data?: any): void {
    if (!this.isProduction) {
      if (data) {
        console.log(`[DEBUG] ${message}`, data);
      } else {
        console.log(`[DEBUG] ${message}`);
      }
    }
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

  // Log financial data safely (only in development)
  logFinancialData(context: string, data: any): void {
    if (!this.isProduction) {
      // Sanitize financial data for logging
      const sanitizedData = this.sanitizeFinancialData(data);
      console.log(`[FINANCIAL] ${context}`, sanitizedData);
    }
  }

  // Sanitize financial data for logging
  private sanitizeFinancialData(data: any): any {
    if (!data) return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeFinancialData(item));
    }
    
    if (typeof data === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Mask sensitive financial fields
        if (key.toLowerCase().includes('amount') || 
            key.toLowerCase().includes('balance') || 
            key.toLowerCase().includes('interest')) {
          sanitized[key] = '***MASKED***';
        } else if (key.toLowerCase().includes('investorid') || 
                   key.toLowerCase().includes('userid')) {
          sanitized[key] = '***MASKED***';
        } else {
          sanitized[key] = this.sanitizeFinancialData(value);
        }
      }
      
      return sanitized;
    }
    
    return data;
  }
}

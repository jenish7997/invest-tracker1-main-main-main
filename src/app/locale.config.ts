import { registerLocaleData } from '@angular/common';
import localeIn from '@angular/common/locales/en-IN';
import { LOCALE_ID } from '@angular/core';

// Register the Indian English locale
registerLocaleData(localeIn);

// Provide the locale configuration
export const localeConfig = {
  provide: LOCALE_ID,
  useValue: 'en-IN'
};

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

interface IpApiCountryResponse {
    countryCode?: string;
    status: string;
    message?: string;
}

const COUNTRY_TO_LANG_MAP: { [key: string]: string } = {
    US: 'en', GB: 'en', CA: 'en', AU: 'en', // English speaking
    DE: 'de', // German
    ES: 'es', // Spanish
    FR: 'fr', // French
    IT: 'it', // Italian
    JP: 'ja', // Japanese
    KR: 'ko', // Korean
    RU: 'ru', // Russian
    CN: 'zh', // Chinese (Simplified)
    TW: 'zhtw', // Chinese (Traditional)
    BR: 'pt', // Portuguese (Brazil) - Assuming pt-BR from ip-api localization, map to 'pt' if general portuguese i18n key is 'pt'
    NL: 'nl', // Dutch
    PL: 'pl', // Polish
    TR: 'tr', // Turkish
    BY: 'by', // Belarusian
    AR: 'ar', // Arabic
    MA: 'ary', // Moroccan Arabic
    // Add more mappings as needed based on available i18n files
};

const DEFAULT_LANGUAGE = 'en';
const USER_LANG_STORAGE_KEY = 'user_preferred_language';

@Injectable({
    providedIn: 'root',
})
export class LanguageDetectionService {
    private readonly httpClient = inject(HttpClient);

    constructor() {}

    getStoredLanguage(): string | null {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(USER_LANG_STORAGE_KEY);
        }
        return null;
    }

    setStoredLanguage(language: string): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(USER_LANG_STORAGE_KEY, language);
        }
    }

    detectInitialLanguage(): Observable<string> {
        const storedLang = this.getStoredLanguage();
        if (storedLang) {
            return of(storedLang);
        }

        // Note: ip-api.com free tier is HTTP only.
        // For production, a secure HTTPS endpoint or a backend proxy would be essential.
        return this.httpClient.get<IpApiCountryResponse>('http://ip-api.com/json/?fields=status,message,countryCode').pipe(
            map(response => {
                if (response.status === 'success' && response.countryCode) {
                    const lang = COUNTRY_TO_LANG_MAP[response.countryCode.toUpperCase()];
                    if (lang) {
                        this.setStoredLanguage(lang); // Store detected language if user hasn't set one
                        return lang;
                    }
                }
                // Fallback for unsuccessful API call or unmapped country code
                this.setStoredLanguage(DEFAULT_LANGUAGE);
                return DEFAULT_LANGUAGE;
            }),
            catchError(error => {
                console.warn('Language detection by IP failed:', error);
                this.setStoredLanguage(DEFAULT_LANGUAGE); // Fallback on error
                return of(DEFAULT_LANGUAGE);
            })
        );
    }
}

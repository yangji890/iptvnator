import { Component, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CommonModule } from '@angular/common';
import { LanguageDetectionService } from '../../../services/language-detection.service';
import { TranslateModule } from '@ngx-translate/core'; // Added import for TranslateModule

interface LanguageOption {
    code: string;
    name: string;
    flag?: string; // Optional flag icon class or image path
}

@Component({
    selector: 'app-language-switcher',
    templateUrl: './language-switcher.component.html',
    styleUrls: ['./language-switcher.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        TranslateModule,
    ],
})
export class LanguageSwitcherComponent {
    private readonly translate = inject(TranslateService);
    private readonly languageDetectionService = inject(LanguageDetectionService); // Inject service

    availableLanguages: LanguageOption[] = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Español' },
        { code: 'fr', name: 'Français' },
        { code: 'de', name: 'Deutsch' },
        { code: 'it', name: 'Italiano' },
        { code: 'pt', name: 'Português' },
        { code: 'ru', name: 'Русский' },
        { code: 'zh', name: '简体中文' },
        { code: 'zhtw', name: '繁體中文' },
        { code: 'ja', name: '日本語' },
        { code: 'ko', name: '한국어' },
        { code: 'ar', name: 'العربية' },
        { code: 'ary', name: 'العربية (المغرب)'},
        { code: 'by', name: 'Беларуская' },
        { code: 'nl', name: 'Nederlands' },
        { code: 'pl', name: 'Polski' },
        { code: 'tr', name: 'Türkçe' },
        // Add more languages based on src/assets/i18n/*.json files
    ];

    currentLanguage: string;

    constructor() {
        this.currentLanguage = this.translate.currentLang || this.translate.defaultLang;
        this.translate.onLangChange.subscribe(event => {
            this.currentLanguage = event.lang;
        });
    }

    switchLanguage(langCode: string): void {
        this.translate.use(langCode);
        this.languageDetectionService.setStoredLanguage(langCode); // Save preference
    }

    getCurrentLanguageName(): string {
        const lang = this.availableLanguages.find(l => l.code === this.currentLanguage);
        return lang ? lang.name : this.currentLanguage.toUpperCase();
    }
}

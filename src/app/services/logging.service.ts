import { Injectable, inject } from '@angular/core';
import { SettingsService } from './settings.service'; // To get user agent potentially
import { STORE_KEY } from '../shared/enums/store-keys.enum'; // For user agent key if stored there
import { TranslateService } from '@ngx-translate/core';

// Define interfaces for log entries (optional but good practice)
interface LogSessionStart {
    type: 'session_start';
    sessionId: string;
    timestamp: string;
    ipAddress?: string; // Usually logged backend-side
    userAgent: string;
    language: string;
    xtreamServerUrl?: string; // If accessed via direct link
    xtreamUsername?: string; // If accessed via direct link
}

interface LogContentView {
    type: 'content_view';
    sessionId: string;
    timestamp: string;
    contentType: 'live' | 'movie' | 'series';
    contentId: string | number;
    contentName: string;
    categoryId?: string | number;
    categoryName?: string;
    seriesDetails?: { // Optional, for series
        season?: number;
        episode?: number;
        episodeId?: string | number;
    };
    viewDurationSeconds?: number; // Optional: calculate if possible
}

interface LogSessionEnd {
    type: 'session_end';
    sessionId: string;
    timestamp: string;
    durationSeconds: number;
}

type LogEntry = LogSessionStart | LogContentView | LogSessionEnd;

@Injectable({
    providedIn: 'root',
})
export class LoggingService {
    private sessionId: string;
    private sessionStartTime: Date;
    private readonly translateService = inject(TranslateService);
    // In a real app, this would likely be injected or configured
    private backendLogEndpoint = '/api/logs'; // Placeholder

    constructor() {
        this.sessionId = this.generateSessionId();
        this.sessionStartTime = new Date();
        this.logSessionStart();

        // Attempt to log session end, though this is unreliable in browser
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.logSessionEnd();
            });
        }
    }

    private generateSessionId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    private getUserAgent(): string {
        return typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    }

    private sendLog(logEntry: LogEntry) {
        // In a real application, this would send the log to a backend server
        console.log('[LOG]', logEntry);

        // Example of how it might be sent (conceptual)
        // this.httpClient.post(this.backendLogEndpoint, logEntry).subscribe({
        //   next: () => console.log('Log sent successfully'),
        //   error: (err) => console.error('Failed to send log:', err)
        // });
    }

    public logSessionStart(xtreamServerUrl?: string, xtreamUsername?: string): void {
        const log: LogSessionStart = {
            type: 'session_start',
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            userAgent: this.getUserAgent(),
            language: this.translateService.currentLang || this.translateService.defaultLang,
            xtreamServerUrl: xtreamServerUrl,
            xtreamUsername: xtreamUsername
        };
        this.sendLog(log);
    }

    public logContentView(
        contentType: 'live' | 'movie' | 'series',
        contentId: string | number,
        contentName: string,
        categoryId?: string | number,
        categoryName?: string,
        seriesDetails?: { season?: number; episode?: number; episodeId?: string | number },
        viewDurationSeconds?: number
    ): void {
        const log: LogContentView = {
            type: 'content_view',
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            contentType,
            contentId,
            contentName,
            categoryId,
            categoryName,
            seriesDetails,
            viewDurationSeconds
        };
        this.sendLog(log);
    }

    public logSessionEnd(): void {
        const durationSeconds = Math.round((new Date().getTime() - this.sessionStartTime.getTime()) / 1000);
        const log: LogSessionEnd = {
            type: 'session_end',
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            durationSeconds
        };
        this.sendLog(log);
        // Note: This log might not always be sent due to browser closing behavior.
    }

    // Specific helper for Xtream link access
    public logXtreamLinkAccess(serverUrl: string, username: string): void {
        // This can be part of session_start or a separate event if needed
        // For now, enriching session_start is sufficient
        console.log(`[LOG] Xtream link accessed: URL=${serverUrl}, User=${username}`);
        // If session already started, perhaps send an update or a specific event
        // For simplicity, we assume this is called early, ideally when session starts.
        // If called later, it might require a different event type e.g., 'xtream_link_params_provided'
    }
}

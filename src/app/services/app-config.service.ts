import { HttpClient } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core'; // Added isDevMode
import { lastValueFrom } from 'rxjs';
import { validateUrl } from '../utils/url-validator'; // Import the validator

interface AppEnvConfig {
    BACKEND_URL: string;
}

// Default URL if config.json fails or running in a context where it's not provided by Docker.
// This should ideally match your local development backend.
const DEFAULT_DEV_BACKEND_URL = 'http://localhost:3333';
const SAFE_FALLBACK_URL = 'http://localhost:3333'; // Fallback if validation fails severely

@Injectable({
    providedIn: 'root',
})
export class AppConfigService {
    private http = inject(HttpClient);
    private appConfig: AppEnvConfig | null = null;

    async loadAppConfig(): Promise<void> {
        console.log('AppConfigService: loadAppConfig() CALLED AND STARTED'); // Explicit start log
        let loadedConfig: AppEnvConfig | null = null;
        try {
            // TEMPORARY DEBUGGING: Use absolute URL to load config.json
            const configUrl = 'http://165.154.255.7/assets/config.json';
            console.log('AppConfigService: Attempting to load config from absolute URL:', configUrl);
            loadedConfig = await lastValueFrom(this.http.get<AppEnvConfig>(configUrl));
            console.log('AppConfigService: Successfully loaded from absolute URL:', loadedConfig);
        } catch (error) {
            console.warn('AppConfigService: Failed to load from absolute URL. Will use default/fallback.', error);
            loadedConfig = { BACKEND_URL: DEFAULT_DEV_BACKEND_URL };
        }

        if (loadedConfig && loadedConfig.BACKEND_URL) {
            const isProductionEnv = !isDevMode();
            if (validateUrl(loadedConfig.BACKEND_URL, isProductionEnv)) {
                this.appConfig = loadedConfig;
                console.log('AppConfigService: BACKEND_URL successfully validated and set to:', this.appConfig.BACKEND_URL);
            } else {
                console.error(
                    `AppConfigService: BACKEND_URL "${loadedConfig.BACKEND_URL}" from config.json failed validation. ` +
                    `isProduction: ${isProductionEnv}. Falling back to SAFE_FALLBACK_URL: ${SAFE_FALLBACK_URL}`
                );
                this.appConfig = { BACKEND_URL: SAFE_FALLBACK_URL };
            }
        } else {
            console.error('AppConfigService: BACKEND_URL missing in loaded config or config itself is null. Using SAFE_FALLBACK_URL.');
            this.appConfig = { BACKEND_URL: SAFE_FALLBACK_URL };
        }
        // Add a log here to see what the final URL is after all logic.
        console.log('AppConfigService: loadAppConfig() FINISHED. Final BACKEND_URL for service instance:', this.appConfig.BACKEND_URL);
    }

    getBackendUrl(): string {
        if (!this.appConfig) {
            console.warn('AppConfigService: getBackendUrl() called but this.appConfig is null. This indicates loadAppConfig() might not have completed or set the config as expected by APP_INITIALIZER. Returning SAFE_FALLBACK_URL.');
            return SAFE_FALLBACK_URL;
        }
        // Log what getBackendUrl is about to return for easier debugging
        // console.log('AppConfigService: getBackendUrl() returning:', this.appConfig.BACKEND_URL || SAFE_FALLBACK_URL);
        return this.appConfig.BACKEND_URL || SAFE_FALLBACK_URL;
    }
}

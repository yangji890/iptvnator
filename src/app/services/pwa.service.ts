import { HttpClient } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Params } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import {
    ERROR,
    PLAYLIST_PARSE_BY_URL,
    PLAYLIST_PARSE_RESPONSE,
    PLAYLIST_UPDATE,
    STALKER_REQUEST,
    STALKER_RESPONSE,
    XTREAM_REQUEST,
    XTREAM_RESPONSE,
} from '../../../shared/ipc-commands';
import { Playlist } from '../../../shared/playlist.interface';
// AppConfig from environments is no longer the source of BACKEND_URL
// import { AppConfig } from '../../environments/environment';
import * as PlaylistActions from '../state/actions';
import { DataService } from './data.service';
import { AppConfigService } from './app-config.service'; // Import AppConfigService

@Injectable({
    providedIn: 'root',
})
export class PwaService extends DataService {
    private readonly http = inject(HttpClient); // Corrected: ensure HttpClient is imported once
    private readonly snackBar = inject(MatSnackBar);
    private readonly store = inject(Store);
    private readonly swUpdate = inject(SwUpdate);
    private readonly translateService = inject(TranslateService);
    private readonly appConfigService = inject(AppConfigService); // Inject AppConfigService

    /** Proxy URL to avoid CORS issues */
    corsProxyUrl: string;

    constructor() {
        super();
        this.corsProxyUrl = this.appConfigService.getBackendUrl();
        console.log('PWA service initialized... CORS Proxy URL:', this.corsProxyUrl);
    }

    /** Uses service worker mechanism to check for available application updates */
    checkUpdates() {
        this.swUpdate.versionUpdates.subscribe(() => {
            this.snackBar
                .open(
                    this.translateService.instant('UPDATE_AVAILABLE'),
                    this.translateService.instant('REFRESH')
                )
                .onAction()
                .subscribe(() => {
                    window.location.reload();
                });
        });
    }

    getAppVersion(): string {
        return AppConfig.version;
    }

    /**
     * Handles incoming IPC commands
     * @param type ipc command type
     * @param payload payload
     */
    sendIpcEvent(type: string, payload?: unknown) {
        if (type === PLAYLIST_PARSE_BY_URL) {
            this.fetchFromUrl(payload);
        } else if (type === PLAYLIST_UPDATE) {
            this.refreshPlaylist(payload);
        } else if (type === XTREAM_REQUEST) {
            return this.forwardXtreamRequest(
                payload as { url: string; params: Record<string, string> }
            );
        } else if (type === STALKER_REQUEST) {
            this.forwardStalkerRequest(
                payload as {
                    url: string;
                    macAddress: string;
                    params: Record<string, string>;
                }
            );
        } else {
            return Promise.resolve();
        }
    }

    refreshPlaylist(payload: Partial<Playlist & { id: string }>) {
        this.getPlaylistFromUrl(payload.url)
            .pipe(
                catchError((error) => {
                    window.postMessage({
                        type: ERROR,
                    });
                    return throwError(() => error);
                })
            )
            .subscribe((playlist: Playlist) => {
                this.store.dispatch(
                    PlaylistActions.updatePlaylist({
                        playlist,
                        playlistId: payload.id,
                    })
                );

                this.snackBar.open(
                    this.translateService.instant(
                        'HOME.PLAYLISTS.PLAYLIST_UPDATE_SUCCESS'
                    ),
                    null,
                    { duration: 2000 }
                );
            });
    }

    /**
     * Fetches playlist from the specified url
     * @param payload playlist payload
     */
    fetchFromUrl(payload: Partial<Playlist>): void {
        this.getPlaylistFromUrl(payload.url)
            .pipe(
                catchError((error) => {
                    window.postMessage({
                        type: ERROR,
                        message: this.getErrorMessageByStatusCode(error.status),
                        status: error.status,
                    });
                    return throwError(() => error);
                })
            )
            .subscribe((response: any) => {
                window.postMessage({
                    type: PLAYLIST_PARSE_RESPONSE,
                    payload: { ...response, isTemporary: payload.isTemporary },
                });
            });
    }

    getErrorMessageByStatusCode(status: number) {
        let message = 'Something went wrong';
        switch (status) {
            case 0:
                message = 'The backend is not reachable';
                break;
            case 413:
                message =
                    'This file is too big. Use standalone or self-hosted version of the app.';
                break;
            default:
                break;
        }
        return message;
    }

    async forwardXtreamRequest(payload: {
        url: string;
        params: Record<string, string>;
        macAddress?: string;
    }) {
        const headers = payload.macAddress
            ? {
                  headers: {
                      Cookie: `mac=${payload.macAddress}`,
                  },
              }
            : {};
        try {
            let result: any;
            const response = await firstValueFrom(
                this.http.get(`${this.corsProxyUrl}/xtream`, {
                    params: {
                        url: payload.url,
                        ...payload.params,
                    },
                    ...headers,
                })
            );

            if (!(response as any).payload) {
                if (payload.params.action === 'get_account_info') return;

                result = {
                    type: ERROR,
                    status: (response as any).status,
                    message: (response as any).message ?? 'Unknown error',
                };
                window.postMessage(result);
            } else {
                result = {
                    type: XTREAM_RESPONSE,
                    payload: (response as any).payload,
                    action: payload.params.action,
                };
                window.postMessage(result);
            }
            return result;
        } catch (error: any) {
            if (payload.params.action === 'get_account_info') return;
            window.postMessage({
                type: ERROR,
                status: error.error?.status,
                message: error.error?.message ?? 'Unknown error',
            });
        }
    }

    forwardStalkerRequest(payload: {
        url: string;
        params: Record<string, string>;
        macAddress: string;
    }) {
        return this.http
            .get(`${this.corsProxyUrl}/stalker`, {
                params: {
                    url: payload.url,
                    ...payload.params,
                    macAddress: payload.macAddress,
                },
            })
            .subscribe((response) => {
                window.postMessage({
                    type: STALKER_RESPONSE,
                    payload: (response as any).payload,
                    action: payload.params.action,
                });
            });
    }

    getPlaylistFromUrl(url: string) {
        return this.http.get(`${this.corsProxyUrl}/parse`, {
            params: { url },
        });
    }

    removeAllListeners(type: string): void {
        // This method is part of the DataService abstract class.
        // In PwaService, listenOn uses window.addEventListener.
        // The AppComponent itself stores and removes these specific listeners.
        // If this service were to manage its own event listeners in a way that
        // required type-based removal, this method would need to implement that.
        // For now, as listeners are managed by the component that adds them,
        // this specific method might not have a direct role for those listeners.
        console.warn(
            `DataService.removeAllListeners called with type "${type}" in PwaService. This implementation of listenOn uses window.addEventListener, and calling components are expected to manage their own listener removal.`
        );
    }

    listenOn(_command: string, callback: (...args: any[]) => void): void {
        // PWA service uses window.postMessage for some IPC-like communication (e.g., from service worker or other contexts)
        // and window.addEventListener for the main app to listen.
        window.addEventListener('message', callback);
    }

    getAppEnvironment(): string {
        return 'pwa';
    }

    fetchData(url: string, queryParams: Params) {
        // not implemented
    }
}

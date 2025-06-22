import { inject } from '@angular/core';
import {
    patchState,
    signalStore,
    withHooks,
    withMethods,
    withState,
} from '@ngrx/signals';
import { StorageMap } from '@ngx-pwa/local-storage';
import { firstValueFrom } from 'rxjs';
import { StreamFormat } from '../settings/stream-format.enum';
import { Language } from '../settings/language.enum';
import { Settings, VideoPlayer } from '../settings/settings.interface';
import { Theme } from '../settings/theme.enum';
import { STORE_KEY } from '../shared/enums/store-keys.enum';

const DEFAULT_SETTINGS: Settings = {
    player: VideoPlayer.VideoJs,
    streamFormat: StreamFormat.M3u8StreamFormat,
    language: Language.ENGLISH,
    showCaptions: false,
    theme: Theme.LightTheme,
    mpvPlayerPath: '',
    vlcPlayerPath: '',
    remoteControl: false,
    remoteControlPort: 3000,
    epgUrl: [],
    flowplayerToken: '', // Added flowplayerToken
};

export const SettingsStore = signalStore(
    { providedIn: 'root' },
    withState<Settings>(DEFAULT_SETTINGS),
    withMethods((store, storage = inject(StorageMap)) => ({
        async loadSettings() {
            const stored = await firstValueFrom(
                storage.get(STORE_KEY.Settings)
            );
            if (stored) {
                // Ensure all keys from DEFAULT_SETTINGS are present, even if not in stored
                // And flowplayerToken is correctly loaded or defaulted
                const mergedSettings = {
                    ...DEFAULT_SETTINGS,
                    ...(stored as Settings),
                    flowplayerToken: (stored as Settings).flowplayerToken || DEFAULT_SETTINGS.flowplayerToken,
                };
                patchState(store, mergedSettings);
            }
        },

        async updateSettings(settingsChanges: Partial<Settings>) {
            // Create a new state object by taking the current state values and applying changes
            const newState: Settings = {
                player: settingsChanges.player ?? store.player(),
                epgUrl: settingsChanges.epgUrl ?? store.epgUrl(),
                streamFormat: settingsChanges.streamFormat ?? store.streamFormat(),
                language: settingsChanges.language ?? store.language(),
                showCaptions: settingsChanges.showCaptions ?? store.showCaptions(),
                theme: settingsChanges.theme ?? store.theme(),
                mpvPlayerPath: settingsChanges.mpvPlayerPath ?? store.mpvPlayerPath(),
                vlcPlayerPath: settingsChanges.vlcPlayerPath ?? store.vlcPlayerPath(),
                remoteControl: settingsChanges.remoteControl ?? store.remoteControl(),
                remoteControlPort: settingsChanges.remoteControlPort ?? store.remoteControlPort(),
                flowplayerToken: settingsChanges.flowplayerToken ?? store.flowplayerToken(),
            };
            patchState(store, newState); // Update the in-memory store state with the full new state
            await firstValueFrom(storage.set(STORE_KEY.Settings, newState)); // Persist the complete new state
        },

        getSettings(): Settings { // Return type changed to Settings
            // This should ideally return the plain object state, not signals directly
            // The signalStore itself provides signal accessors like store.player()
            // This method is more for getting a snapshot if needed outside signal context.
            return {
                player: store.player(),
                streamFormat: store.streamFormat(),
                language: store.language(),
                showCaptions: store.showCaptions(),
                theme: store.theme(),
                mpvPlayerPath: store.mpvPlayerPath(),
                vlcPlayerPath: store.vlcPlayerPath(),
                remoteControl: store.remoteControl(),
                remoteControlPort: store.remoteControlPort(),
                epgUrl: store.epgUrl(),
                flowplayerToken: store.flowplayerToken(), // Added flowplayerToken
            };
        },
    })),
    withHooks({
        onInit(store) {
            store.loadSettings();
        },
    })
);

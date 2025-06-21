import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { OPEN_MPV_PLAYER, OPEN_VLC_PLAYER } from '../../../shared/ipc-commands';
import { VideoPlayer } from '../settings/settings.interface';
import { ExternalPlayerInfoDialogComponent } from '../shared/components/external-player-info-dialog/external-player-info-dialog.component';
import {
    PlayerDialogComponent,
    PlayerDialogData,
} from '../xtream-tauri/player-dialog/player-dialog.component';
import { FlowplayerDialogComponent, FlowplayerDialogData } from '../shared/components/flowplayer-dialog/flowplayer-dialog.component'; // Import Flowplayer dialog
import { DataService } from './data.service';
import { SettingsStore } from './settings-store.service';
import { LoggingService } from './logging.service';
import { XtreamStore } from '../xtream-tauri/xtream.store'; // To get content details

@Injectable({
    providedIn: 'root',
})
export class PlayerService {
    private dialog = inject(MatDialog);
    private dataService = inject(DataService);
    private settingsStore = inject(SettingsStore);
    private loggingService = inject(LoggingService); // Inject LoggingService
    private xtreamStore = inject(XtreamStore); // Inject XtreamStore

    openPlayer(
        streamUrl: string,
        title: string, // This title is often the item's name
        thumbnail?: string,
        hideExternalInfoDialog = true,
        isLiveContent = false // This flag helps determine content type
    ) {
        const player = this.settingsStore.player() ?? VideoPlayer.VideoJs;
        const selectedItem = this.xtreamStore.selectedItem(); // Get the full item details
        const selectedCategory = this.xtreamStore.getSelectedCategory();

        let contentType: 'live' | 'movie' | 'series' = 'movie'; // Default
        if (isLiveContent) {
            contentType = 'live';
        } else if (selectedItem && (selectedItem as any).series_id) {
            contentType = 'series';
        } else if (selectedItem && (selectedItem as any).stream_id && (selectedItem as any).movie_data) {
            contentType = 'movie';
        }
        // Fallback if isLiveContent is false but item type is not clear
        else if (selectedItem && selectedItem.type) {
             contentType = selectedItem.type as ('live' | 'movie' | 'series');
        }


        if (selectedItem) {
            this.loggingService.logContentView(
                contentType,
                (selectedItem as any).stream_id || (selectedItem as any).series_id || selectedItem.id,
                title, // Use the provided title which should be the item name
                selectedCategory?.id,
                selectedCategory?.name,
                contentType === 'series' ? {
                    season: (selectedItem as any).season, // Assuming season number is available
                    // episode: (selectedItem as any).episode, // Assuming episode number is available on the clicked episode item
                    // episodeId: (selectedItem as any).id // Assuming the selected item IS the episode
                } : undefined
                // Duration can be logged when playback stops, which is harder to track here
            );
        }


        if (player === VideoPlayer.MPV) {
            if (!hideExternalInfoDialog) {
                this.dialog.open(ExternalPlayerInfoDialogComponent);
            }
            this.dataService.sendIpcEvent(OPEN_MPV_PLAYER, {
                url: streamUrl,
                mpvPlayerPath: this.settingsStore.mpvPlayerPath(),
                title,
                thumbnail,
            });
        } else if (player === VideoPlayer.VLC) {
            if (!hideExternalInfoDialog) {
                this.dialog.open(ExternalPlayerInfoDialogComponent);
            }
            this.dataService.sendIpcEvent(OPEN_VLC_PLAYER, {
                url: streamUrl,
                vlcPlayerPath: this.settingsStore.vlcPlayerPath(),
            });
        } else if (player === VideoPlayer.Flowplayer && !isLiveContent) {
            this.dialog.open<FlowplayerDialogComponent, FlowplayerDialogData>(
                FlowplayerDialogComponent,
                {
                    data: { streamUrl, title, token: this.settingsStore.flowplayerToken() }, // Assuming token is stored in settings
                    width: '80%', // Or specific dimensions for video
                    maxWidth: '1200px',
                    maxHeight: '90vh', // Or use panelClass for custom styling
                    panelClass: 'flowplayer-dialog-panel' // Add a class for specific styling
                }
            );
        } else if (player === VideoPlayer.VideoJs && !isLiveContent) { // Default to VideoJs or other existing dialog players
            this.dialog.open<PlayerDialogComponent, PlayerDialogData>(
                PlayerDialogComponent, // This is likely the Video.js dialog
                {
                    data: { streamUrl, title },
                    width: '80%',
                    maxWidth: '1200px',
                    maxHeight: '90vh',
                }
            );
        }
        // What about Html5Player, DPlayer, ArtPlayer if selected and !isLiveContent?
        // And what about live content for VideoJs, Flowplayer, etc.?
        // Current logic seems to only open dialogs for VOD/Series.
        // Live content with these players might be embedded directly in a view,
        // or would also need a dialog if that's the chosen UX.
        // For now, this commit focuses on adding Flowplayer for VOD/Series via dialog.

        // Note: For live content with VideoJS/default player, it's handled directly in component,
        // so logging for that would need to be in the component that embeds the VideoJS player.
        // This service primarily handles external players or dialog-based internal players.
    }
}

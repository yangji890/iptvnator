import {
    CdkVirtualScrollViewport,
    ScrollingModule,
} from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    inject,
    Output,
    signal,
    ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // Added MatSnackBar & MatSnackBarModule
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core'; // Added TranslateService
import { XtreamCategory } from '../../../../shared/xtream-category.interface';
import { XtreamItem } from '../../../../shared/xtream-item.interface';
import { FilterPipe } from '../../shared/pipes/filter.pipe';
import { FavoritesService } from '../services/favorites.service';
import { XtreamStore } from '../xtream.store';

interface EpgProgram {
    id: string;
    title: string;
    start: string;
    end: string;
    start_timestamp: string;
    stop_timestamp: string;
}

@Component({
    selector: 'app-portal-channels-list',
    templateUrl: './portal-channels-list.component.html',
    styleUrls: ['./portal-channels-list.component.scss'],
    imports: [
        DatePipe,
        FilterPipe,
        FormsModule,
        MatFormFieldModule,
        ScrollingModule,
        MatCardModule,
        MatIcon,
        MatIconButton,
        MatListModule,
        MatInputModule,
        TranslateModule,
        MatTooltipModule,
        MatSnackBarModule, // Added MatSnackBarModule to imports
    ]
})
export class PortalChannelsListComponent implements AfterViewInit {
    @Output() playClicked = new EventEmitter<any>();

    readonly xtreamStore = inject(XtreamStore);
    private readonly favoritesService = inject(FavoritesService);
    private readonly route = inject(ActivatedRoute);
    private readonly snackBar = inject(MatSnackBar); // Injected MatSnackBar
    private readonly translate = inject(TranslateService); // Injected TranslateService
    readonly channels = this.xtreamStore.selectItemsFromSelectedCategory;

    favorites = new Map<number, boolean>();
    searchString = signal<string>('');
    currentPrograms = new Map<number, string>();
    currentProgramsProgress = new Map<number, number>();
    programTimings = new Map<number, { start: number; end: number }>();
    private requestedChannels = new Set<number>();
    private epgLoadRetries = new Map<number, number>(); // For retry mechanism
    private readonly MAX_EPG_RETRIES = 2;
    private cachedNow: number | null = null; // For debouncing Date.now() calls
    private animationFrameId: number | null = null; // To manage requestAnimationFrame


    @ViewChild(CdkVirtualScrollViewport) viewport?: CdkVirtualScrollViewport;

    constructor(private cdr: ChangeDetectorRef) {}

    trackBy(_index: number, item: XtreamItem) {
        return item.xtream_id; // Assuming xtream_id is unique and stable
    }

    ngOnInit(): void {
        const { categoryId } = this.route.snapshot.params;
        if (categoryId)
            this.xtreamStore.setSelectedCategory(Number(categoryId));

        const playlist = this.xtreamStore.currentPlaylist();
        if (playlist) {
            this.favoritesService
                .getFavorites(playlist.id)
                .subscribe((favorites) => {
                    // Map using content.id instead of xtream_id
                    favorites.forEach((fav: any) => {
                        this.favorites.set(fav.xtream_id, true);
                    });
                    console.log(this.favorites);
                });
        }
        // Removed loadCurrentEpgData() call since we're using virtual scroll
    }

    ngAfterViewInit() {
        if (
            this.viewport &&
            this.xtreamStore.selectedContentType() === 'live'
        ) {
            this.viewport.renderedRangeStream.subscribe((range) => {
                const visibleChannels = this.channels().slice(
                    range.start,
                    range.end
                );
                this.loadEpgForVisibleChannels(visibleChannels);
            });
        }
    }

    private async loadEpgForVisibleChannels(channels: any[]): Promise<void> {
        const playlist = this.xtreamStore.currentPlaylist();
        if (!playlist) return;

        for (const channel of channels) {
            // Skip if we already requested or have EPG data for this channel
            if (
                this.requestedChannels.has(channel.xtream_id) ||
                this.currentPrograms.has(channel.xtream_id)
            ) {
                continue;
            }

            // Mark as requested before making the API call
            this.requestedChannels.add(channel.xtream_id);

            try {
                const epgData = await this.xtreamStore.loadChannelEpg(
                    channel.xtream_id
                );
                if (epgData && epgData.length > 0) {
                    this.currentPrograms.set(
                        channel.xtream_id,
                        epgData[0].title
                    );
                    this.updateProgramProgress(channel.xtream_id, epgData[0]);
                    this.cdr.detectChanges();
                    this.epgLoadRetries.delete(channel.xtream_id); // Reset retry count on success
                }
            } catch (error) {
                console.error(`Failed to load EPG for channel ${channel.name} (ID: ${channel.xtream_id}):`, error);
                const retries = this.epgLoadRetries.get(channel.xtream_id) || 0;
                if (retries < this.MAX_EPG_RETRIES) {
                    this.epgLoadRetries.set(channel.xtream_id, retries + 1);
                    // Simple immediate retry for demonstration. In a real app, use a delay or backoff.
                    console.log(`Retrying EPG load for ${channel.name} (Attempt ${retries + 1})`);
                    this.requestedChannels.delete(channel.xtream_id); // Allow re-request
                    // Potentially call loadEpgForVisibleChannels again or a specific retry function
                    // For simplicity here, the next visibility check will re-trigger if still visible.
                } else {
                    // Max retries reached, notify user
                    const message = this.translate.instant('PORTALS.ERROR_VIEW.EPG_LOAD_FAILED_FOR_CHANNEL', { channelName: channel.name });
                    this.snackBar.open(message, this.translate.instant('CLOSE'), { duration: 3000 });
                    this.epgLoadRetries.delete(channel.xtream_id); // Reset after max retries
                }
            }
        }
    }

    private getDebouncedNow(): number {
        if (this.cachedNow === null) {
            this.cachedNow = Date.now();
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }
            this.animationFrameId = requestAnimationFrame(() => {
                this.cachedNow = null;
                this.animationFrameId = null;
            });
        }
        return this.cachedNow;
    }

    private updateProgramProgress(streamId: number, program: EpgProgram) {
        const now = this.getDebouncedNow() / 1000; // Use debounced time, in seconds
        const start = parseInt(program.start_timestamp);
        const end = parseInt(program.stop_timestamp);

        if (now >= start && now <= end) {
            const duration = end - start;
            const elapsed = now - start;
            const progress = (elapsed / duration) * 100;

            this.currentProgramsProgress.set(streamId, Math.min(Math.max(progress, 0), 100)); // Ensure progress is between 0 and 100
            this.programTimings.set(streamId, {
                start: start * 1000, // Convert to milliseconds for date pipe
                end: end * 1000, // Convert to milliseconds for date pipe
            });
        } else {
            // Optional: Clear progress if program is no longer current
            this.currentProgramsProgress.delete(streamId);
            this.programTimings.delete(streamId);
        }
    }

    isSelected(item: XtreamCategory): boolean {
        const selectedCategory = this.xtreamStore.selectedCategoryId();
        const itemId = Number((item as any).category_id || item.id);
        return selectedCategory !== null && selectedCategory === itemId;
    }

    toggleFavorite(event: Event, item: any) {
        event.stopPropagation();
        this.xtreamStore
            .toggleFavorite(
                item.xtream_id,
                this.xtreamStore.currentPlaylist().id
            )
            .then((result: boolean) => {
                if (result) {
                    this.favorites.set(item.xtream_id, true);
                } else {
                    this.favorites.delete(item.xtream_id);
                }
                this.cdr.detectChanges();
            });
    }

    ngOnDestroy(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}

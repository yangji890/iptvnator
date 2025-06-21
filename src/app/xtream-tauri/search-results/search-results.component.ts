import { KeyValuePipe } from '@angular/common';
import {
    AfterViewInit,
    Component,
    ElementRef,
    inject,
    Inject,
    OnDestroy,
    OnInit,
    Optional,
    ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import groupBy from 'lodash/groupBy';
import { debounceTime, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { XtreamItem } from '../../../../shared/xtream-item.interface';
import { DatabaseService } from '../../services/database.service';
import { XtreamStore } from '../xtream.store';
import { PlaylistsService } from '../../services/playlists.service';
import { DataService } from '../../services/data.service';
import { PlaylistMeta } from '../../shared/playlist-meta.type';
import { XtreamCodeActions } from '../../../../shared/xtream-code-actions';
import { MatProgressBarModule } from '@angular/material/progress-bar';

interface SearchResultsData {
    isGlobalSearch: boolean;
}

const isTauri = !!(window as any).__TAURI__;

@Component({
    selector: 'app-search-results',
    imports: [
        MatIconButton,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatIcon,
        MatCheckboxModule,
        FormsModule,
        MatDialogModule,
        KeyValuePipe,
        MatProgressBarModule, // Added progress bar
    ],
    providers: [],
    templateUrl: './search-results.component.html',
    styleUrls: ['./search-results.component.scss'],
})
export class SearchResultsComponent
    implements OnInit, AfterViewInit, OnDestroy
{
    @ViewChild('searchInput') searchInput!: ElementRef;
    readonly xtreamStore = inject(XtreamStore);
    readonly router = inject(Router);
    readonly activatedRoute = inject(ActivatedRoute);
    readonly databaseService = inject(DatabaseService);
    readonly playlistsService = inject(PlaylistsService); // Injected PlaylistsService
    readonly dataService = inject(DataService); // Injected DataService

    searchTerm = '';
    filters = {
        live: true,
        movie: true,
        series: true,
    };
    isGlobalSearch = false; // This will be determined by the route or dialog data
    isLoading = false;
    private searchSubject = new Subject<string>();
    private destroy$ = new Subject<void>();
    private readonly DEBOUNCE_TIME = 300;

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) private data?: SearchResultsData,
        @Optional() public dialogRef?: MatDialogRef<SearchResultsComponent>
    ) {
        // If opened as a dialog, use dialog data. Otherwise, it's a page.
        this.isGlobalSearch = data?.isGlobalSearch ?? true; // Default to true if not a dialog or no data
    }

    ngOnInit(): void {
        this.activatedRoute.queryParamMap
            .pipe(takeUntil(this.destroy$))
            .subscribe((params) => {
                const query = params.get('q');
                if (query) {
                    this.searchTerm = query;
                    this.onSearch(); // Trigger search if query param exists
                }
            });

        this.searchSubject
            .pipe(debounceTime(this.DEBOUNCE_TIME), takeUntil(this.destroy$))
            .subscribe(() => {
                this.executeSearch();
            });

        // For global search page, we are not in a dialog context.
        // We determine `isGlobalSearch` based on component's purpose (always true for this page)
        // If this component can also be playlist-specific search, then route data/params should dictate it.
        // For now, assuming this is always the global search page when not a dialog.
        if (!this.dialogRef) {
            this.isGlobalSearch = true;
        }
    }

    ngAfterViewInit() {
        this.xtreamStore.setSelectedContentType(undefined); // Clear any category context
        if (this.searchInput?.nativeElement) {
            setTimeout(() => {
                this.searchInput.nativeElement.focus();
            });
        }
    }

    onSearch() {
        // Update URL query parameter as user types
        if (this.isGlobalSearch && this.searchTerm.trim() !== '') {
             this.router.navigate([], {
                relativeTo: this.activatedRoute,
                queryParams: { q: this.searchTerm.trim() },
                queryParamsHandling: 'merge', // Merge with existing query params
                replaceUrl: true // Replace history state instead of pushing new one
            });
        }


        if (this.searchTerm.length >= 3) {
            this.searchSubject.next(this.searchTerm);
        } else {
            this.xtreamStore.resetSearchResults();
        }
    }

    private async executeSearch() {
        if (this.searchTerm.length < 3) {
            this.xtreamStore.resetSearchResults();
            return;
        }

        this.isLoading = true;
        const types = Object.entries(this.filters)
            .filter(([_, enabled]) => enabled)
            .map(([type]) => type);

        try {
            if (this.isGlobalSearch) {
                if (isTauri) {
                    await this.searchGlobalTauri(this.searchTerm, types);
                } else {
                    await this.searchGlobalWeb(this.searchTerm, types);
                }
            } else {
                // This part is for playlist-specific search, might need playlistId context
                // For now, assuming global search path in xtream-main-container leads here.
                // If a playlist is active in xtreamStore, this will search within it.
                this.xtreamStore.searchContent({
                    term: this.searchTerm,
                    types,
                });
            }
        } catch (error) {
            console.error('Error during search execution:', error);
            this.xtreamStore.resetSearchResults();
        } finally {
            this.isLoading = false;
        }
    }

    private async searchGlobalTauri(term: string, types: string[]) {
        try {
            const results = await this.databaseService.globalSearchContent(
                term,
                types
            );
            if (results && Array.isArray(results)) {
                this.xtreamStore.setGlobalSearchResults(results);
            }
        } catch (error) {
            console.error('Error in Tauri global search:', error);
            this.xtreamStore.resetSearchResults();
        }
    }

    private async searchGlobalWeb(term: string, types: string[]) {
        let allPlaylists: PlaylistMeta[] = [];
        try {
            allPlaylists = await lastValueFrom(
                this.playlistsService.getAllPlaylists().pipe(
                    map(playlists => playlists.filter(p => p.type === 'xtream' && p.serverUrl && p.username && p.password))
                )
            );
        } catch (error) {
            console.error('Error fetching playlists for web search:', error);
            this.xtreamStore.resetSearchResults();
            return;
        }

        if (allPlaylists.length === 0) {
            this.xtreamStore.resetSearchResults();
            return;
        }

        const searchPromises = allPlaylists.map(async (playlist) => {
            const playlistResults: XtreamItem[] = [];
            const { serverUrl, username, password, _id: playlist_id, title: playlist_name } = playlist;

            const actionsToFetch: { action: XtreamCodeActions; type: 'live' | 'movie' | 'series'; resultKey?: string }[] = [];
            if (types.includes('live')) actionsToFetch.push({ action: XtreamCodeActions.GetLiveStreams, type: 'live' });
            if (types.includes('movie')) actionsToFetch.push({ action: XtreamCodeActions.GetVodStreams, type: 'movie' });
            if (types.includes('series')) actionsToFetch.push({ action: XtreamCodeActions.GetSeries, type: 'series'});


            for (const { action, type } of actionsToFetch) {
                try {
                    const items = await this.dataService.fetchData<XtreamItem[]>(
                        `${serverUrl}/player_api.php`,
                        { username, password, action }
                    );

                    if (items && Array.isArray(items)) {
                        const filteredItems = items.filter(item =>
                            item.name?.toLowerCase().includes(term.toLowerCase()) ||
                            (item as any).title?.toLowerCase().includes(term.toLowerCase())
                        ).map(item => ({
                            ...item,
                            type: item.stream_type || type, // Ensure type is set
                            playlist_id,
                            playlist_name,
                            // Ensure common fields like xtream_id, category_id, poster_url are mapped if names differ
                            xtream_id: item.stream_id || (item as any).series_id || item.id,
                            category_id: item.category_id,
                            poster_url: item.stream_icon || (item as any).cover || (item as any).icon,
                            title: item.name || (item as any).title,
                        }));
                        playlistResults.push(...filteredItems);
                    }
                } catch (err) {
                    console.warn(`Failed to fetch/search ${type} for playlist ${playlist_name}:`, err);
                }
            }
            return playlistResults;
        });

        try {
            const resultsByPlaylist = await Promise.all(searchPromises);
            const aggregatedResults = resultsByPlaylist.flat();
            this.xtreamStore.setGlobalSearchResults(aggregatedResults);
        } catch (error) {
            console.error('Error aggregating web search results:', error);
            this.xtreamStore.resetSearchResults();
        }
    }


    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.searchSubject.complete();
    }

    selectItem(
        item: XtreamItem & { playlist_id?: string; playlist_name?: string }
    ) {
        if (this.dialogRef) {
            this.dialogRef.close(); // Close if it's a dialog
        }

        // Common navigation logic
        const typeForNav = item.stream_type === 'movie' ? 'vod' : item.stream_type;
        const playlistId = item.playlist_id || this.xtreamStore.currentPlaylist()?._id; // Fallback to current if not global

        if (!playlistId) {
            console.error('Playlist ID is missing for navigation');
            return;
        }

        this.xtreamStore.resetSearchResults(); // Reset search results before navigating

        if (item.stream_type === 'live') {
             this.router.navigate([
                '/xtreams',
                playlistId,
                typeForNav,
                item.category_id,
                // For live streams, direct navigation might be to category, player handles specific stream
            ]);
            // Potentially, directly trigger play if item.xtream_id is available and player can handle it
            // this.xtreamStore.constructStreamUrl(item); // Example, if direct play is intended
        } else {
             this.router.navigate([
                '/xtreams',
                playlistId,
                typeForNav,
                item.category_id,
                item.xtream_id, // stream_id for VOD, series_id for Series
            ]);
        }
    }

    getGroupedResults() {
        const results = this.xtreamStore.searchResults(); // searchResults now holds global results too
        if (!this.isGlobalSearch || !results) return { default: results || [] };
        return groupBy(results, 'playlist_name');
    }
}

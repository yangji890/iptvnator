import {
    Component,
    Input,
    ViewChild,
    ElementRef,
    AfterViewInit,
    OnDestroy,
    OnChanges,
    SimpleChanges,
    ChangeDetectionStrategy,
    inject,
} from '@angular/core';
import flowplayer, {
    FlowplayerInstance,
    FlowplayerOptions,
    PlayerEvent,
    ErrorEvent, // Import ErrorEvent type
} from '@flowplayer/player';
import { LoggingService } from '../../../services/logging.service'; // Import LoggingService

// HLS plugin might be needed explicitly if not bundled or auto-loaded by core @flowplayer/player
// import '@flowplayer/player/dist/plugins/hls.min.js'; // Or specific import if it's a module

@Component({
    selector: 'app-flowplayer',
    templateUrl: './flowplayer.component.html',
    styleUrls: ['./flowplayer.component.scss'],
    standalone: true,
    imports: [], // No specific Angular modules needed for the component itself yet
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowplayerComponent implements AfterViewInit, OnDestroy, OnChanges {
    @Input() streamUrl: string;
    @Input() title?: string;
    @Input() autoplay: boolean = false;
    @Input() token?: string = 'YOUR_FLOWPLAYER_TOKEN'; // Placeholder - THIS IS THE CRITICAL PART

    @ViewChild('playerContainer') playerContainer!: ElementRef<HTMLDivElement>;

    private player?: FlowplayerInstance;
    private loggingService = inject(LoggingService);
    private loadStartTime: number;
    private playbackStartedSuccessfully = false; // To avoid logging success multiple times on resume

    constructor() {
        // Warn about the token if it's the placeholder
        if (this.token === 'YOUR_FLOWPLAYER_TOKEN') {
            console.warn(
                'FlowplayerComponent: Using placeholder token for Flowplayer. Playback may be restricted or watermarked. Please provide a valid token in settings.'
            );
        }
    }

    ngAfterViewInit(): void {
        this.initializePlayer();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.player) {
            if (changes.streamUrl && !changes.streamUrl.firstChange && changes.streamUrl.currentValue !== changes.streamUrl.previousValue) {
                this.player.setSrc(changes.streamUrl.currentValue, () => {
                    if (this.autoplay) {
                        this.player?.togglePlay(true);
                    }
                });
            }
            // Handle other input changes if necessary, e.g., title (if player supports dynamic title update)
        }
    }

    private initializePlayer(): void {
        if (!this.playerContainer?.nativeElement) {
            console.error('Flowplayer container not found in DOM.');
            return;
        }

        if (!this.streamUrl) {
            console.warn('FlowplayerComponent: streamUrl is not provided.');
            return;
        }

        // Make sure to destroy previous instance if any
        this.destroyPlayer();

        const options: FlowplayerOptions = {
            src: this.streamUrl,
            token: this.token, // Mandatory for Flowplayer
            autoplay: this.autoplay,
            // live: true, // Set this if you know it's a live stream, helps UI
            // ratio: '16:9', // Or let it be dynamic
            // Add other options as needed: hlsQualities, hls, etc.
        };

        if (this.title) {
            options.title = this.title;
        }

        // Check if HLS plugin is globally available or needs specific init
        // This might involve checking window.flowplayer.hlsjs and configuring options.hlsjs
        // e.g. options.hlsjs = { ...HLS.js specific config... }
        // For now, assume core player + hls plugin (if loaded via script tag or auto-import) handles M3U8

        this.loadStartTime = performance.now();
        this.playbackStartedSuccessfully = false; // Reset for new source

        try {
            this.player = flowplayer(this.playerContainer.nativeElement, options);

            // Event listeners for statistics
            this.player.on(PlayerEvent.READY, (event) => {
                const readyTime = performance.now();
                const startupTimeMs = Math.round(readyTime - this.loadStartTime);
                console.log(`Flowplayer Ready. Startup time (to ready): ${startupTimeMs}ms`, event);
                // This is often too early for "perceived" startup time. PLAYING is better.
            });

            this.player.on(PlayerEvent.PLAYING, (event) => {
                if (!this.playbackStartedSuccessfully) {
                    this.playbackStartedSuccessfully = true;
                    const playingTime = performance.now();
                    const startupTimeMs = Math.round(playingTime - this.loadStartTime);
                    console.log(`Flowplayer Playing. Perceived startup time: ${startupTimeMs}ms`, event);

                    // Log successful playback start and startup time
                    // The initial LogContentView from PlayerService might be too early for startup time.
                    // We can log an update or a specific performance metric here.
                    this.loggingService.logContentView(
                        'flowplayer' as any, // content type could be more specific if known here
                        this.streamUrl, // Using streamUrl as a contentId for this specific log
                        this.title || 'Unknown Flowplayer Content',
                        undefined, undefined, undefined, // category info not directly available here
                        startupTimeMs // Logging startup time
                    );
                    // A more refined approach would be to emit an event from here,
                    // and let a parent/service decide how to log it in conjunction with PlayerService's initial log.
                }
            });

            this.player.on(PlayerEvent.ERROR, (event, _api, error: ErrorEvent) => {
                console.error('Flowplayer Error:', error);
                this.playbackStartedSuccessfully = false; // Mark as not successful on error

                // Log playback failure
                // Ideally, we'd get more context about the content from inputs if not already logged by PlayerService
                this.loggingService.logContentView(
                    'flowplayer-error' as any,
                     this.streamUrl,
                    `ERROR: ${this.title || 'Unknown Flowplayer Content'} - Code: ${error.code} - ${error.message}`,
                );
            });

        } catch (error) {
            console.error('Error initializing Flowplayer:', error);
            // Log initialization failure
            this.loggingService.logContentView(
                'flowplayer-init-error' as any,
                this.streamUrl,
                `INIT ERROR: ${this.title || 'Unknown Flowplayer Content'}`,
            );
        }
    }

    private destroyPlayer(): void {
        if (this.player) {
            try {
                this.player.destroy();
                this.player = undefined;
            } catch (error) {
                console.error('Error destroying Flowplayer instance:', error);
            }
        }
    }

    ngOnDestroy(): void {
        this.destroyPlayer();
    }

    // Public methods for controlling the player if needed from parent
    play(): void {
        this.player?.togglePlay(true);
    }

    pause(): void {
        this.player?.togglePlay(false);
    }
}

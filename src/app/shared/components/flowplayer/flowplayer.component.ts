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
import flowplayer from '@flowplayer/player'; // Keep default import for the function
// Types seem not to be exported directly, using 'any' for now.
// import { FlowplayerInstance, FlowplayerOptions, PlayerEvent, ErrorEvent } from '@flowplayer/player';
import { LoggingService } from '../../../services/logging.service';

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

    private player?: any; // Changed FlowplayerInstance to any
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

        const options: any = { // Changed FlowplayerOptions to any
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

            // Event listeners for statistics using string event names
            this.player.on('ready', (event: any) => { // Use 'any' for event if specific type isn't available
                const readyTime = performance.now();
                const startupTimeMs = Math.round(readyTime - this.loadStartTime);
                console.log(`Flowplayer Ready. Startup time (to ready): ${startupTimeMs}ms`, event);
            });

            this.player.on('playing', (event: any) => {
                if (!this.playbackStartedSuccessfully) {
                    this.playbackStartedSuccessfully = true;
                    const playingTime = performance.now();
                    const startupTimeMs = Math.round(playingTime - this.loadStartTime);
                    console.log(`Flowplayer Playing. Perceived startup time: ${startupTimeMs}ms`, event);

                    this.loggingService.logContentView(
                        'flowplayer' as any,
                        this.streamUrl,
                        this.title || 'Unknown Flowplayer Content',
                        undefined, undefined, undefined,
                        startupTimeMs
                    );
                }
            });

            // Standard HTML5 error event name is 'error'.
            // Flowplayer's STANDARD_ERROR is flowplayer.events.STANDARD_ERROR
            // If flowplayer.events is not typed, we might need to use 'error' and inspect the error object.
            this.player.on('error', (event: any, _api?: any, errorDetails?: any) => {
                // The 'error' event for HTMLMediaElement usually just gives a simple event.
                // For more detailed errors, Flowplayer might have a specific error structure
                // passed to the callback, or through a more specific event like 'standardError'.
                // For now, logging what we get.
                const err = errorDetails || this.player?.engine?.error || event; // Try to get more specific error
                console.error('Flowplayer Error:', err);
                this.playbackStartedSuccessfully = false;

                let errorMessage = 'Unknown Flowplayer Error';
                if (err && err.code) { // Standard MediaError codes
                    errorMessage = `Error Code: ${err.code}`;
                    if (err.message) errorMessage += ` - ${err.message}`;
                } else if (err && err.message) {
                    errorMessage = err.message;
                } else if (typeof err === 'string') {
                    errorMessage = err;
                }

                this.loggingService.logContentView(
                    'flowplayer-error' as any,
                    this.streamUrl,
                    `ERROR: ${this.title || 'Unknown Flowplayer Content'} - ${errorMessage}`,
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

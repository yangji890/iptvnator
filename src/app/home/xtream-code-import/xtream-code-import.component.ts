import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import {
    FormControl,
    FormGroup,
    FormsModule,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute } from '@angular/router'; // ActivatedRoute import
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { v4 as uuid } from 'uuid';
import { Playlist } from '../../../../shared/playlist.interface';
import {
    PortalStatus,
    PortalStatusService,
} from '../../services/portal-status.service';
import { LoggingService } from '../../services/logging.service'; // Import LoggingService
import { addPlaylist } from '../../state/actions';
import { take } from 'rxjs';

@Component({
    imports: [
        FormsModule,
        MatButton,
        MatFormFieldModule,
        MatIcon,
        MatInputModule,
        ReactiveFormsModule,
        TranslatePipe,
    ],
    selector: 'app-xtream-code-import',
    templateUrl: './xtream-code-import.component.html',
    styles: [
        `
            :host {
                display: flex;
                margin: 10px;
                justify-content: center;
            }

            form {
                width: 100%;
            }

            .status-active {
                color: #4caf50;
            }

            .status-inactive {
                color: #f44336;
            }

            .status-expired {
                color: #ff9800;
            }

            .status-unavailable {
                color: #9e9e9e;
            }

            .connection-status {
                margin: 10px 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .button-row {
                display: flex;
                justify-content: space-between;
            }
        `,
    ],
})
export class XtreamCodeImportComponent implements OnInit {
    @Output() addClicked = new EventEmitter<void>();
    URL_REGEX = /^(http|https|file):\/\/[^ "]+$/;

    form = new FormGroup({
        _id: new FormControl(uuid()),
        title: new FormControl('', [Validators.required]),
        password: new FormControl('', [Validators.required]),
        username: new FormControl('', [Validators.required]),
        serverUrl: new FormControl('', [
            Validators.required,
            Validators.pattern(this.URL_REGEX),
        ]),
        importDate: new FormControl(new Date().toISOString()),
    });

    readonly store = inject(Store);
    readonly portalStatusService = inject(PortalStatusService);
    private readonly route = inject(ActivatedRoute);
    private readonly loggingService = inject(LoggingService); // Injected LoggingService

    connectionStatus: PortalStatus | null = null;
    isTestingConnection = false;

    ngOnInit(): void {
        this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
            const server = params.get('server');
            const user = params.get('user');
            const pass = params.get('pass'); // Password itself won't be logged directly for security
            const title = params.get('title');

            let autoTrigger = false;
            const fieldsToPatch: Partial<typeof this.form.value> = {};

            if (server) {
                fieldsToPatch.serverUrl = server;
                autoTrigger = true;
            }
            if (user) {
                fieldsToPatch.username = user;
                autoTrigger = true;
            }
            if (pass) {
                fieldsToPatch.password = pass; // Still needed for form
                autoTrigger = true;
            }
            if (title) {
                fieldsToPatch.title = title;
            } else if (server && user && !this.form.value.title) { // Check if server and user are from params
                try {
                    fieldsToPatch.title = `Xtream ${new URL(server).hostname}`;
                } catch (e) { /* ignore invalid URL for title generation */ }
            }

            if (Object.keys(fieldsToPatch).length > 0) {
                this.form.patchValue(fieldsToPatch);
            }

            // If essential params were found from URL, log this access and auto-test
            if (server && user) { // Log if server and user were from params
                this.loggingService.logSessionStart(server, user); // Pass to enrich session start
                // Or: this.loggingService.logXtreamLinkAccess(server, user); if a separate event is preferred

                if (this.form.valid) { // Check validity after patching
                    this.testConnection().then(() => {
                        // Optional: auto-add if connection is good
                        // if (this.connectionStatus === 'active') { this.addPlaylist(); }
                    });
                }
            } else if (autoTrigger && this.form.valid) {
                 // Fallback if only some params were provided but enough to trigger
                 this.testConnection();
            }
        });
    }

    async testConnection(): Promise<void> {
        if (!this.form.valid) return;

        this.isTestingConnection = true;
        this.connectionStatus = null; // Reset status before testing
        const serverUrlAsString = this.form.value.serverUrl as string;
        let serverUrlToTest = '';
        try {
            const url = new URL(serverUrlAsString);
            serverUrlToTest = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`;
        } catch (e) {
            this.form.get('serverUrl')?.setErrors({ pattern: true});
            this.isTestingConnection = false;
            return;
        }


        try {
            this.connectionStatus =
                await this.portalStatusService.checkPortalStatus(
                    serverUrlToTest,
                    this.form.value.username as string,
                    this.form.value.password as string
                );
        } catch (error) {
            console.error('Error testing connection:', error);
            this.connectionStatus = 'unavailable';
        } finally {
            this.isTestingConnection = false;
        }
    }

    getStatusMessage(): string {
        return this.portalStatusService.getStatusMessage(this.connectionStatus);
    }

    getStatusClass(): string {
        return this.portalStatusService.getStatusClass(this.connectionStatus);
    }

    getStatusIcon(): string {
        return this.portalStatusService.getStatusIcon(this.connectionStatus);
    }

    addPlaylist() {
        if (!this.form.valid) return;
        const serverUrlAsString = this.form.value.serverUrl as string;
        const url = new URL(serverUrlAsString); // Assumes valid URL due to form validation
        const serverUrl = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`;
        this.store.dispatch(
            addPlaylist({
                playlist: {
                    ...this.form.value,
                    serverUrl, // Ensure this is the cleaned base URL
                    type: 'xtream', // Explicitly set type
                } as Playlist,
            })
        );
        this.addClicked.emit();
        this.form.reset({ // Reset form after adding
            _id: uuid(),
            title: '',
            password: '',
            username: '',
            serverUrl: '',
            importDate: new Date().toISOString()
        });
        this.connectionStatus = null;
    }

    extractParams(urlAsString: string): void {
        // Only extract if username and password fields are empty,
        // to avoid overwriting values from URL query params or manual input.
        if (
            this.form.get('username').value ||
            this.form.get('password').value
        ) {
            // If serverUrl is changed by user and it's different from what was in query params,
            // we might want to clear username/password if they were from query params.
            // This logic can be complex. For now, simple check.
            return;
        }

        try {
            const url = new URL(urlAsString);
            const username = url.searchParams.get('username');
            const password = url.searchParams.get('password');

            const currentServerVal = this.form.get('serverUrl').value;
            // Check if the server URL itself contains username/password as query params
            // and if the form fields are currently empty.
            if (username && !this.form.get('username').value) {
                 this.form.get('username')?.setValue(username);
            }
            if (password && !this.form.get('password').value) {
                this.form.get('password')?.setValue(password);
            }

            // If title is empty and serverUrl is being set (potentially with params)
            // and no title came from URL query params, try to auto-generate one.
            if (!this.form.get('title').value && currentServerVal === urlAsString) {
                 const autoTitle = `Xtream ${url.hostname}`;
                 if (!this.form.get('title').value) { // Check again in case title was from query param
                    this.form.get('title')?.setValue(autoTitle);
                 }
            }

        } catch (error) {
            // console.warn('Could not extract params from server URL input:', error);
            // Don't log error for invalid URL during typing
        }
    }
}

import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
    ComponentFixture,
    inject,
    TestBed,
    waitForAsync,
} from '@angular/core/testing';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MockComponent, MockModule, MockPipe, MockProviders } from 'ng-mocks';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { NgxWhatsNewComponent } from 'ngx-whats-new';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { DataService } from './services/data.service';
import { ElectronServiceStub } from './services/electron.service.stub';
import { PlaylistsService } from './services/playlists.service';
import { SettingsService } from './services/settings.service';
import { WhatsNewService } from './services/whats-new.service';
import { WhatsNewServiceStub } from './services/whats-new.service.stub';
import { Language } from './settings/language.enum';
import { Theme } from './settings/theme.enum';
import { STORE_KEY } from './shared/enums/store-keys.enum';
import { of } from 'rxjs'; // Ensure 'of' is imported for mock services
import { AUTO_UPDATE_PLAYLISTS } from '../../shared/ipc-commands';
import { PlaylistMeta } from './shared/playlist-meta.type'; // Assuming PlaylistMeta path

// Mock isTauri from @tauri-apps/api/core
jest.mock('@tauri-apps/api/core', () => ({
    ...jest.requireActual('@tauri-apps/api/core'), // Preserve other exports
    isTauri: jest.fn(),
}));
import { isTauri } from '@tauri-apps/api/core'; // Import the mocked version

jest.spyOn(global.console, 'error').mockImplementation(() => {});

describe('AppComponent', () => {
    let component: AppComponent;
    let dataService: DataService; // Renamed from electronService for clarity, though it's DataService
    let fixture: ComponentFixture<AppComponent>;
    let settingsService: SettingsService;
    let translateService: TranslateService;
    let whatsNewService: WhatsNewService;
    const defaultLanguage = 'en';

    let playlistsService: PlaylistsService; // Added playlistsService
    let mockIsTauri: jest.Mock; // For controlling isTauri mock

    // Mocks for services not fully covered by MockProviders or needing specific spies
    class MockDataServiceStub {
        getAppVersion = jest.fn().mockReturnValue('1.0.0');
        sendIpcEvent = jest.fn();
        listenOn = jest.fn();
        removeAllListeners = jest.fn();
        getAppEnvironment = jest.fn().mockReturnValue('tauri');
        isElectron = false;
        remote = { process: { platform: 'linux', argv: [] } };
    }

    class MockPlaylistsServiceStub {
        getPlaylistsForAutoUpdate = jest.fn().mockReturnValue(of([]));
    }


    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            declarations: [AppComponent, MockPipe(TranslatePipe)],
            providers: [
                { provide: WhatsNewService, useClass: WhatsNewServiceStub },
                { provide: DataService, useClass: MockDataServiceStub }, // Use more specific mock
                { provide: PlaylistsService, useClass: MockPlaylistsServiceStub }, // Use more specific mock
                MockProviders( // These are fine if default mock behavior is okay
                    TranslateService,
                    NgxIndexedDBService,
                    MatSnackBar,
                    SettingsService, // SettingsService can be mocked more specifically if needed
                    EpgService,      // Added EpgService
                    MatDialog,       // Added MatDialog
                    Router,          // Added Router (RouterTestingModule is in imports)
                    Store            // Added Store (provideMockStore handles this)
                ),
                provideMockStore(), // For NgRx Store
                // LanguageDetectionService needs to be mocked if AppComponent uses it directly in constructor/ngOnInit for tested logic
                // Based on current AppComponent, it's injected via inject() so might be harder to mock globally here
                // or provide a specific mock. For triggerAutoUpdateMechanism, it's not directly used.
            ],
            imports: [
                MockModule(MatSnackBarModule),
                MockComponent(NgxWhatsNewComponent),
                RouterTestingModule,
                HttpClientTestingModule,
            ],
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(AppComponent);
        component = fixture.componentInstance;
        dataService = TestBed.inject(DataService);
        playlistsService = TestBed.inject(PlaylistsService);
        settingsService = TestBed.inject(SettingsService);
        translateService = TestBed.inject(TranslateService);
        whatsNewService = TestBed.inject(WhatsNewService);
        mockIsTauri = isTauri as jest.Mock; // Assign the mocked import

        // DO NOT mock component.triggerAutoUpdateMechanism here if we want to test its actual implementation
        // component.triggerAutoUpdateMechanism = jest.fn(); // REMOVE THIS LINE for the new tests
        component.modals = [];
        component.checkForUpdates = jest.fn(); // Keep this mocked if not testing it now
        fixture.detectChanges();
    });

    it('should create the component and set default language', () => {
        jest.spyOn(translateService, 'setDefaultLang');
        jest.spyOn(component, 'setRendererListeners');
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.debugElement.componentInstance;
        expect(app).toBeTruthy();
        expect(component.DEFAULT_LANG).toEqual(Language.ENGLISH);
    });

    it('should init component', () => {
        jest.spyOn(translateService, 'setDefaultLang');
        jest.spyOn(component, 'setRendererListeners');
        jest.spyOn(component, 'initSettings');
        jest.spyOn(component, 'handleWhatsNewDialog');
        component.ngOnInit();
        expect(translateService.setDefaultLang).toHaveBeenCalledWith(
            defaultLanguage
        );
        expect(component.setRendererListeners).toHaveBeenCalledTimes(1);
        expect(component.initSettings).toHaveBeenCalledTimes(1);
        expect(component.handleWhatsNewDialog).toHaveBeenCalledTimes(1);
    });

    describe('Test ipc listeners and commands', () => {
        it('should set IPC listeners', () => {
            jest.spyOn(electronService, 'listenOn');
            component.setRendererListeners();
            expect(electronService.listenOn).toHaveBeenCalledTimes(
                component.commandsList.length
            );
        });

        it('should remove all ipc listeners on destroy', () => {
            jest.spyOn(electronService, 'removeAllListeners');
            component.ngOnDestroy();
            expect(electronService.removeAllListeners).toHaveBeenCalledTimes(
                component.commandsList.length
            );
        });

        it('should navigate to the provided route', inject(
            [Router],
            (router: Router) => {
                const route = '/add-playlists';
                jest.spyOn(router, 'navigateByUrl');
                component.navigateToRoute(route);
                expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
                expect(router.navigateByUrl).toHaveBeenCalledWith(route);
            }
        ));

        it('show show whats new dialog', () => {
            jest.spyOn(whatsNewService, 'getModalsByVersion');
            jest.spyOn(component, 'setDialogVisibility');
            component.showWhatsNewDialog();
            expect(whatsNewService.getModalsByVersion).toHaveBeenCalledTimes(1);
            expect(component.setDialogVisibility).toHaveBeenCalledWith(true);
        });
    });

    describe('Test version handling', () => {
        it('should get actual app version which is outdated and show updates dialog', () => {
            const currentAppVersion = '0.0.1';
            const spyOnSettingsGet = jest
                .spyOn(settingsService, 'getValueFromLocalStorage')
                .mockReturnValue(of(currentAppVersion));
            jest.spyOn(whatsNewService, 'getModalsByVersion').mockReturnValue([
                {},
            ]);
            jest.spyOn(whatsNewService, 'changeDialogVisibleState');

            component.handleWhatsNewDialog();
            expect(spyOnSettingsGet).toHaveBeenCalled();
            expect(whatsNewService.getModalsByVersion).toHaveBeenCalled();
            expect(
                whatsNewService.changeDialogVisibleState
            ).toHaveBeenCalledWith(true);
        });

        it('should get actual app version which is not outdated and do not shop updates dialog', () => {
            const currentAppVersion = '1.0.0';
            const spyOnSettingsGet = jest
                .spyOn(settingsService, 'getValueFromLocalStorage')
                .mockReturnValue(of(currentAppVersion));
            jest.spyOn(whatsNewService, 'getModalsByVersion').mockReturnValue([
                {},
            ]);
            jest.spyOn(whatsNewService, 'changeDialogVisibleState');

            component.handleWhatsNewDialog();
            expect(spyOnSettingsGet).toHaveBeenCalled();
            expect(whatsNewService.getModalsByVersion).toHaveBeenCalledTimes(0);
            expect(
                whatsNewService.changeDialogVisibleState
            ).toHaveBeenCalledTimes(0);
        });

        it('should change the visibility of the whats new dialog', () => {
            jest.spyOn(whatsNewService, 'changeDialogVisibleState');
            component.modals = [{}, {}];
            const visibilityFlag = true;
            component.setDialogVisibility(true);

            expect(
                whatsNewService.changeDialogVisibleState
            ).toHaveBeenCalledWith(visibilityFlag);
            expect(
                whatsNewService.changeDialogVisibleState
            ).toHaveBeenCalledTimes(1);
        });

        it('should not change the visibility of the whats new dialog', () => {
            jest.spyOn(whatsNewService, 'changeDialogVisibleState');
            component.modals = [];
            component.setDialogVisibility(true);
            expect(
                whatsNewService.changeDialogVisibleState
            ).toHaveBeenCalledTimes(0);
        });
    });

    describe('Set initial settings', () => {
        const theme = Theme.DarkTheme;
        const language = 'es';
        const epgUrl = ['http://localhost/epg.xml'];

        beforeEach(() => {
            jest.spyOn(electronService, 'sendIpcEvent');
            jest.spyOn(settingsService, 'changeTheme');
            jest.spyOn(component, 'handleWhatsNewDialog');
            jest.spyOn(translateService, 'use');
        });

        it('should get and init settings (all settings are defined)', () => {
            const spyOnSettingsGet = jest
                .spyOn(settingsService, 'getValueFromLocalStorage')
                .mockReturnValue(of({ theme, epgUrl, language }));

            component.initSettings();

            expect(spyOnSettingsGet).toHaveBeenCalledWith(STORE_KEY.Settings);
            expect(settingsService.changeTheme).toHaveBeenCalledWith(theme);
            expect(electronService.sendIpcEvent).toHaveBeenCalledTimes(1);
            expect(translateService.use).toHaveBeenCalledWith(language);
        });

        it('should get and init settings (nothing is defined)', () => {
            const spyOnSettingsGet = jest
                .spyOn(settingsService, 'getValueFromLocalStorage')
                .mockReturnValue(of());

            component.initSettings();

            expect(spyOnSettingsGet).toHaveBeenCalledWith(STORE_KEY.Settings);
            expect(settingsService.changeTheme).toHaveBeenCalledTimes(0);
            expect(electronService.sendIpcEvent).toHaveBeenCalledTimes(0);
            expect(translateService.use).toHaveBeenCalledTimes(0);
        });

        it('should get and init settings (only theme is defined)', () => {
            const spyOnSettingsGet = jest
                .spyOn(settingsService, 'getValueFromLocalStorage')
                .mockReturnValue(of({ theme }));

            component.initSettings();

            expect(spyOnSettingsGet).toHaveBeenCalledWith(STORE_KEY.Settings);
            expect(settingsService.changeTheme).toHaveBeenCalledWith(theme);
            expect(electronService.sendIpcEvent).toHaveBeenCalledTimes(1);
            expect(translateService.use).toHaveBeenCalledWith(defaultLanguage);
        });
    });

    // New describe block for triggerAutoUpdateMechanism
    describe('triggerAutoUpdateMechanism', () => {
        beforeEach(() => {
            // Ensure isTauri mock is reset before each test in this block
            mockIsTauri.mockReset();
            // Reset spies on services if they are called in multiple tests
            (playlistsService.getPlaylistsForAutoUpdate as jest.Mock).mockClear();
            (dataService.sendIpcEvent as jest.Mock).mockClear();
        });

        it('should do nothing if not in Tauri environment', async () => {
            mockIsTauri.mockReturnValue(false);

            await component.triggerAutoUpdateMechanism();

            expect(playlistsService.getPlaylistsForAutoUpdate).not.toHaveBeenCalled();
            expect(dataService.sendIpcEvent).not.toHaveBeenCalled();
        });

        it('should send IPC event if in Tauri environment and playlists are available for auto-update', async () => {
            mockIsTauri.mockReturnValue(true);
            const mockPlaylists: Partial<PlaylistMeta>[] = [{ _id: '1', title: 'Test Playlist', autoRefresh: true }];
            (playlistsService.getPlaylistsForAutoUpdate as jest.Mock).mockReturnValue(of(mockPlaylists));

            await component.triggerAutoUpdateMechanism();

            expect(playlistsService.getPlaylistsForAutoUpdate).toHaveBeenCalled();
            expect(dataService.sendIpcEvent).toHaveBeenCalledWith(AUTO_UPDATE_PLAYLISTS, mockPlaylists);
        });

        it('should not send IPC event if in Tauri environment but no playlists for auto-update', async () => {
            mockIsTauri.mockReturnValue(true);
            (playlistsService.getPlaylistsForAutoUpdate as jest.Mock).mockReturnValue(of([])); // No playlists

            await component.triggerAutoUpdateMechanism();

            expect(playlistsService.getPlaylistsForAutoUpdate).toHaveBeenCalled();
            expect(dataService.sendIpcEvent).not.toHaveBeenCalled();
        });

        it('should not send IPC event if in Tauri environment but playlists are null for auto-update', async () => {
            mockIsTauri.mockReturnValue(true);
            (playlistsService.getPlaylistsForAutoUpdate as jest.Mock).mockReturnValue(of(null)); // Playlists result is null

            await component.triggerAutoUpdateMechanism();

            expect(playlistsService.getPlaylistsForAutoUpdate).toHaveBeenCalled();
            expect(dataService.sendIpcEvent).not.toHaveBeenCalled();
        });
    });
});

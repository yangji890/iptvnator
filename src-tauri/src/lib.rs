mod commands;
mod database;
mod epg;

use database::get_migrations;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = get_migrations();

    let app_builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:database.db", migrations) // Assuming migrations is Clone or Copy, or not used after this.
                .build(), // This returns a Result<TauriPlugin, Error>
                           // Proper error handling for plugin build would be:
                           // .build().map_err(|e| /* handle or convert error */)?
                           // For now, allowing it to propagate to the main app build.
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            commands::epg::fetch_epg,
            commands::epg::get_channel_programs,
            commands::epg::get_epg_by_range,
            commands::media::open_in_mpv,
            commands::media::open_in_vlc,
            commands::media::get_active_mpv_processes,
            commands::media::close_mpv_process
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?; // The `?` operator propagates errors out of setup
            }
            // Example of where a custom fallible database init (if it existed) would be handled:
            // match my_custom_database_init(app.handle()) {
            //     Ok(db_conn) => { /* store db_conn in state */ }
            //     Err(err) => {
            //         eprintln!("Custom DB init failed: {}", err);
            //         // Show dialog to user (non-blocking)
            //         let handle = app.handle().clone();
            //         tauri::async_runtime::spawn(async move {
            //             tauri::api::dialog::MessageDialogBuilder::new("Initialization Error", "Failed to initialize database.")
            //                 .kind(tauri::api::dialog::MessageDialogKind::Error)
            //                 .show(move |ok| { if ok { /* Optionally exit app */ std::process::exit(1); }});
            //         });
            //         // To halt app startup from setup, return an Err from setup
            //         return Err(Box::new(err)); // Convert your error to Box<dyn std::error::Error>
            //     }
            // }
            Ok(())
        });

    // Build the app instance
    match app_builder.build(tauri::generate_context!()) {
        Ok(app) => {
            // Run the app
            // The run method's callback provides an AppHandle and a RunEvent.
            // It doesn't typically return a Result itself that you'd match on for post-run errors.
            // Critical errors during run usually cause a panic or are handled by OS.
            app.run(|_app_handle, event| match event {
                tauri::RunEvent::ExitRequested { api, .. } => {
                    // Example: To prevent exit based on some condition
                    // if some_condition_not_met {
                    //     api.prevent_exit();
                    // }
                }
                _ => {}
            });
        }
        Err(e) => {
            // This block catches errors from app_builder.build()
            eprintln!("Failed to build/initialize Tauri application: {:?}", e);
            // Attempt to show a native dialog if possible, as Tauri's API might not be fully available.
            // This is a best-effort for user feedback on critical startup failure.
            // Note: If tauri::generate_context!() itself fails, this might not even be reached gracefully.
            // For truly pre-Tauri-init errors, a simple panic might be the only outcome.
            // Using a crate like `native_dialog` could be an option for very early errors,
            // but that adds another dependency. For now, eprintln and exit.
            if cfg!(windows) {
                // Simplistic way to show a message box on Windows if really needed,
                // but usually not done this way for cross-platform.
                // Can use `msgbox` crate or similar for better cross-platform native dialogs if essential.
            }
            std::process::exit(1);
        }
    }
}

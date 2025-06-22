import { inject } from '@angular/core';
import {
    patchState,
    signalStoreFeature,
    withMethods,
    withState,
} from '@ngrx/signals';
import { DatabaseService } from '../services/database.service';
import { FavoritesService } from './services/favorites.service';

// Define an interface for the expected query result
interface ContentIdQueryResult {
    id: number; // Assuming content.id from the database is a number
}

export const withFavorites = function () {
    return signalStoreFeature(
        withState({
            isFavorite: false,
        }),
        withMethods(
            (
                store,
                dbService = inject(DatabaseService),
                favoritesService = inject(FavoritesService)
            ) => ({
                async toggleFavorite(xtreamId: number, playlistId: string) {
                    let result = false;
                    if (!xtreamId || !playlistId) return;

                    const db = await dbService.getConnection();

                    // Use the defined interface for the select query result
                    const contentResults = await db.select<ContentIdQueryResult[]>(
                        'SELECT content.id FROM content ' +
                            'INNER JOIN categories ON content.category_id = categories.id ' +
                            'WHERE content.xtream_id = ? AND categories.playlist_id = ?',
                        [xtreamId, playlistId]
                    );

                    if (!contentResults || contentResults.length === 0) {
                        console.error(`Content with xtreamId ${xtreamId} not found in database for playlist ${playlistId}`);
                        return false; // Return a boolean to indicate failure or no-op
                    }

                    const contentId = contentResults[0].id; // contentId is now typed as number
                    const isFavorite = await favoritesService.isFavorite(
                        xtreamId,
                        playlistId
                    );

                    if (isFavorite) {
                        await favoritesService.removeFromFavorites(
                            contentId,
                            playlistId
                        );
                        result = false;
                    } else {
                        await favoritesService.addToFavorites({
                            content_id: contentId,
                            playlist_id: playlistId,
                        });
                        result = true;
                    }

                    patchState(store, { isFavorite: !isFavorite });
                    return result;
                },

                async checkFavoriteStatus(
                    xtreamId: number,
                    playlistId: string
                ) {
                    if (!xtreamId || !playlistId) {
                        patchState(store, { isFavorite: false });
                        return;
                    }

                    if (!xtreamId) {
                        patchState(store, { isFavorite: false });
                        return;
                    }

                    const isFavorite = await favoritesService.isFavorite(
                        xtreamId,
                        playlistId
                    );

                    patchState(store, { isFavorite });
                },
            })
        )
    );
};

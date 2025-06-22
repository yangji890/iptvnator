export const AppConfig = {
    production: true,
    environment: 'PROD',
    version: require('../../package.json').version,
    // BACKEND_URL is now loaded at runtime via AppConfigService from /assets/config.json
    // BACKEND_URL: 'https://iptvnator-playlist-parser-api.vercel.app',
};

export const AppConfig = {
    production: false,
    environment: 'WEB',
    version: require('../../package.json').version,
    // BACKEND_URL is now loaded at runtime via AppConfigService from /assets/config.json
    // BACKEND_URL: 'http://localhost:3333', // This was the one mentioned in the review
};

/**
 * Validates a given URL, with an option to enforce HTTPS in production.
 *
 * @param url The URL string to validate.
 * @param isProduction A boolean indicating if the current environment is production.
 * @returns True if the URL is valid according to the criteria, false otherwise.
 */
export function validateUrl(url: string, isProduction: boolean): boolean {
    if (!url || typeof url !== 'string') {
        console.error('Validation Error: URL must be a non-empty string.');
        return false;
    }

    try {
        const parsedUrl = new URL(url);

        // Basic protocol check
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            console.error(`Validation Error: URL protocol must be http: or https:. Received: ${parsedUrl.protocol}`);
            return false;
        }

        // Enforce HTTPS in production, allow http for non-production (e.g. localhost)
        if (isProduction && parsedUrl.protocol !== 'https:') {
            console.error(`Validation Error: Production environment requires HTTPS for BACKEND_URL. Received: ${url}`);
            return false;
        }

        // Check for a valid hostname (very basic check, more complex validation might be needed for specific rules)
        // Hostname should exist and not be an empty string.
        // Browsers and new URL() are generally good at parsing valid hostnames.
        if (!parsedUrl.hostname || parsedUrl.hostname.trim() === '') {
            console.error(`Validation Error: URL must have a valid hostname. Received: ${url}`);
            return false;
        }

        // Add more specific checks if needed, e.g., disallowing certain characters,
        // or ensuring it's not an IP address in production unless specifically allowed.

        return true;
    } catch (e) {
        // new URL(url) will throw a TypeError if the URL is invalid/malformed
        console.error(`Validation Error: Invalid URL format. ${e.message}. Received: ${url}`);
        return false;
    }
}

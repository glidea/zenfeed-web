import { get } from "svelte/store";
import { apiUrl } from "$lib/stores/apiUrl";
import { browser } from '$app/environment'; // Import browser check

/**
 * Checks if the given URL string points to localhost or 127.0.0.1.
 * @param url The URL string to check.
 * @returns True if the hostname is localhost or 127.0.0.1, false otherwise.
 */
function isApiUrlLocalhost(url: string | null): boolean {
    if (!url) return false;
    try {
        const parsedUrl = new URL(url);
        // Check hostname for localhost or 127.0.0.1
        return ["localhost", "127.0.0.1"].includes(parsedUrl.hostname);
    } catch (e) {
        console.error("Invalid API URL format:", url, e);
        return false; // Treat invalid URL as not localhost for safety
    }
}

/**
 * Determines the appropriate API URL to use for a fetch request.
 *
 * - If called in the browser AND the configured apiUrl is localhost, it uses the direct backend URL.
 * - Otherwise (on server OR configured apiUrl is not localhost), it uses the proxy path `/api/...`
 *   and appends the actual backend URL as a `backendUrl` query parameter.
 *
 * @param endpointPath The specific API endpoint path (e.g., '/query_config'). MUST start with a slash '/'.
 * @returns The URL string (either proxy with parameter or direct) to use for the fetch request.
 */
export function getTargetApiUrl(endpointPath: string): string {
    const actualBackendUrl = get(apiUrl); // Get the current configured backend URL

    // Use proxy if NOT on browser OR if the API URL is not localhost
    const useProxy = !browser || !isApiUrlLocalhost(actualBackendUrl);

    let targetUrl: string;

    if (useProxy) {
        // Ensure endpointPath starts with a slash, but the final path doesn't have double slashes
        const cleanEndpointPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
        // Append the actual backend URL as a query parameter for the server-side proxy
        targetUrl = `/api${cleanEndpointPath}?backendUrl=${encodeURIComponent(actualBackendUrl)}`;
    } else {
        // Use the direct backend URL (only happens in browser when target is localhost)
        // Ensure endpointPath starts with a slash
        const cleanEndpointPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
        targetUrl = `${actualBackendUrl}${cleanEndpointPath}`;
    }

    return targetUrl;
}
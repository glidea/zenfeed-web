import { error as skError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

const disableApiProxyQueryConfig = env.PUBLIC_DISABLE_API_PROXY_QUERY_CONFIG === "true";
const disableApiProxyApplyConfig = env.PUBLIC_DISABLE_API_PROXY_APPLY_CONFIG === "true";

// This handler will attempt to proxy requests for any method (GET, POST, etc.)
const handler: RequestHandler = async (event) => {
    const { request, fetch, params, url } = event;
    const backendUrl = url.searchParams.get('backendUrl'); // Get backend URL from query parameter

    if (!backendUrl) {
        // It's crucial that the client provides this parameter when using the proxy
        throw skError(400, 'Bad Request: Missing backendUrl query parameter for proxy request.');
    }

    try {
        // Validate the backendUrl format (optional but recommended)
        new URL(backendUrl);
    } catch (e) {
        throw skError(400, `Bad Request: Invalid backendUrl format: ${backendUrl}`);
    }

    // `params.path` will contain the matched path segments after /api/
    const endpointPath = params.path;

    if (disableApiProxyQueryConfig && endpointPath.startsWith('query_config')) {
        throw skError(404, 'Not Found: Query config endpoint is disabled.');
    }

    if (disableApiProxyApplyConfig && endpointPath.startsWith('apply_config')) {
        throw skError(404, 'Not Found: Apply config endpoint is disabled.');
    }

    const targetUrl = `${backendUrl}/${endpointPath}`;

    console.log(`Proxying ${request.method} request for /api/${endpointPath} to: ${targetUrl}`); // Optional: server-side logging

    try {
        // Forward the request to the backend
        const response = await fetch(targetUrl, {
            method: request.method,
            headers: {
                'Content-Type': request.headers.get('Content-Type') || '',
                'Accept': request.headers.get('Accept') || '*/*',
            },
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
            duplex: 'half'
        } as RequestInit);

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: new Headers(response.headers)
        });

    } catch (e: any) {
        console.error(`Error proxying /api/${endpointPath}:`, e);
        if (e.cause && e.cause.code) {
            if (e.cause.code === 'ECONNREFUSED') {
                throw skError(503, `Service Unavailable: Could not connect to backend at ${backendUrl}`);
            }
        }
        throw skError(500, `Failed to proxy request to backend: ${e.message || 'Unknown error'}`);
    }
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;


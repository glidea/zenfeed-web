// svelte.config.js
import adapterNode from '@sveltejs/adapter-node';
import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Determine the target adapter based on environment variable
const target = process.env.ADAPTER_TARGET || 'node'; // Default to 'node' if not set

let adapter;
if (target === 'cloudflare') {
    console.log("Using Cloudflare adapter");
    adapter = adapterCloudflare({
        // Cloudflare specific options if needed
        routes: {
            include: ['/*'],
            exclude: ['<all>'] // Example option
        }
    });
} else { // Default or 'node'
    console.log("Using Node adapter");
    adapter = adapterNode({
        // Node specific options if needed, e.g., out: 'build' (which is default)
    });
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://kit.svelte.dev/docs/integrations#preprocessors
    // for more information about preprocessors
    preprocess: vitePreprocess(),

    kit: {
        adapter: adapter
    }
};

export default config;
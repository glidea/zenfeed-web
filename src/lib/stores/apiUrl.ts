import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const defaultApiUrl = 'http://localhost:1300';

const initialApiUrl = browser ? localStorage.getItem('zenfeed_api_url') ?? defaultApiUrl : defaultApiUrl;

export const apiUrl = writable<string>(initialApiUrl);

if (browser) {
    apiUrl.subscribe(value => {
        localStorage.setItem('zenfeed_api_url', value);
    });
} 
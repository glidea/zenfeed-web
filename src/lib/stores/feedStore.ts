import { writable } from 'svelte/store';

interface SelectedFeedData {
    title: string;
    summaryHtmlSnippet: string;
    link: string;
}

export const selectedFeed = writable<SelectedFeedData | null>(null); 
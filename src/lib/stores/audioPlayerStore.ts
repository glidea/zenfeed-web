import { writable } from "svelte/store";
import type { FeedVO } from "$lib/types/feed";
import { getFeedItemId } from "$lib/utils/feedUtils";
import { browser } from "$app/environment";

export interface AudioTrack {
    id: string;
    url: string;
    title: string;
    link: string;
}

export interface AudioPlayerState {
    currentTrack: AudioTrack | null;
    playlist: AudioTrack[];
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    isPlayerVisible: boolean;
}

const initialState: AudioPlayerState = {
    currentTrack: null,
    playlist: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isPlayerVisible: false,
};

function createAudioPlayerStore() {
    const { subscribe, update, set } = writable<AudioPlayerState>(initialState);

    function findTrackIndex(trackId: string, playlist: AudioTrack[]): number {
        return playlist.findIndex(t => t.id === trackId);
    }

    return {
        subscribe,
        startPlaying: (feed: FeedVO, allFeeds: FeedVO[]) => {
            update(state => {
                if (!browser) return state;

                const playlist = allFeeds
                    .filter(f => f.labels?.podcast_url)
                    .map(f => ({
                        id: getFeedItemId(f),
                        url: f.labels.podcast_url!,
                        title: '[' + f.labels.source + '] ' + f.labels.title || 'Untitled',
                        link: f.labels.link,
                    }));

                const currentTrack: AudioTrack = {
                    id: getFeedItemId(feed),
                    url: feed.labels.podcast_url!,
                    title: '[' + feed.labels.source + '] ' + feed.labels.title || 'Untitled',
                    link: feed.labels.link,
                };

                return {
                    ...state,
                    currentTrack,
                    playlist,
                    isPlaying: true,
                    isPlayerVisible: true,
                    currentTime: 0,
                };
            });
        },
        togglePlayPause: () => {
            if (!browser) return;
            update(state => ({
                ...state,
                isPlaying: !state.isPlaying,
            }));
        },
        playNext: () => {
            if (!browser) return;
            update(state => {
                if (!state.currentTrack) return state;

                const currentIndex = findTrackIndex(state.currentTrack.id, state.playlist);
                if (currentIndex === -1 || currentIndex >= state.playlist.length - 1) {
                    return { ...state, isPlaying: false };
                }

                const nextTrack = state.playlist[currentIndex + 1];
                return {
                    ...state,
                    currentTrack: nextTrack,
                    isPlaying: true,
                    currentTime: 0,
                };
            });
        },
        playPrevious: () => {
            update(state => {
                if (!browser) return state;
                if (!state.currentTrack) return state;

                const currentIndex = findTrackIndex(state.currentTrack.id, state.playlist);
                if (currentIndex <= 0) {
                    return state;
                }

                const previousTrack = state.playlist[currentIndex - 1];
                return {
                    ...state,
                    currentTrack: previousTrack,
                    isPlaying: true,
                    currentTime: 0,
                };
            });
        },
        updateTime: (currentTime: number, duration: number) => {
            update(state => ({
                ...state,
                currentTime,
                duration,
            }));
        },
        closePlayer: () => {
            if (!browser) return;
            set(initialState);
        },
        _handleTrackEnd: () => {
            update(state => {
                if (!state.currentTrack) return state;

                const currentIndex = findTrackIndex(state.currentTrack.id, state.playlist);
                if (currentIndex === -1 || currentIndex >= state.playlist.length - 1) {
                    return { ...state, isPlaying: false, currentTime: state.duration };
                }

                const nextTrack = state.playlist[currentIndex + 1];
                return {
                    ...state,
                    currentTrack: nextTrack,
                    isPlaying: true,
                    currentTime: 0,
                };
            });
        },
    };
}

export const audioPlayerStore = createAudioPlayerStore(); 
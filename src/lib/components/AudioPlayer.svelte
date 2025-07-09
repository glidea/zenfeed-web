<script lang="ts">
    import { audioPlayerStore } from "$lib/stores/audioPlayerStore";
    import { onDestroy } from "svelte";
    import { slide } from "svelte/transition";

    let audio: HTMLAudioElement;
    let progress: HTMLProgressElement;

    const state = audioPlayerStore;

    $: if (
        audio &&
        $state.currentTrack?.url &&
        audio.src !== $state.currentTrack.url
    ) {
        audio.src = $state.currentTrack.url;
        if ($state.isPlaying) {
            audio.play().catch((e) => console.error("Audio play failed:", e));
        }
    }

    $: if (audio) {
        if ($state.isPlaying) {
            audio
                .play()
                .catch((e) => console.error("Audio play failed on toggle:", e));
        } else {
            audio.pause();
        }
    }

    function formatTime(seconds: number): string {
        if (isNaN(seconds) || seconds < 0) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    function handleSeek(event: MouseEvent) {
        if (!progress || !$state.duration) return;
        const { left, width } = progress.getBoundingClientRect();
        const clickX = event.clientX - left;
        const seekTime = (clickX / width) * $state.duration;
        audio.currentTime = seekTime;
    }

    const unsubscribe = state.subscribe(() => {});

    onDestroy(unsubscribe);
</script>

{#if $state.isPlayerVisible}
    <div
        class="fixed bottom-0 left-0 right-0 bg-base-200/80 backdrop-blur-md shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-50 text-base-content"
        transition:slide={{ duration: 300 }}
    >
        <div class="max-w-4xl mx-auto px-4 py-2">
            <div class="relative h-2 mb-1 cursor-pointer" on:click={handleSeek}>
                <progress
                    bind:this={progress}
                    class="progress progress-primary absolute top-1/2 -translate-y-1/2 w-full h-1"
                    value={$state.currentTime}
                    max={$state.duration || 1}
                ></progress>
            </div>

            <div class="flex items-center justify-between gap-4">
                <div class="flex-1 min-w-0">
                    {#if $state.currentTrack}
                        <p
                            class="font-semibold truncate text-sm"
                            title={$state.currentTrack.title}
                        >
                            {$state.currentTrack.title}
                        </p>
                        <div class="text-xs opacity-70">
                            <span>{formatTime($state.currentTime)}</span> /
                            <span>{formatTime($state.duration)}</span>
                        </div>
                    {/if}
                </div>

                <div class="flex items-center gap-2">
                    <button
                        class="btn btn-ghost btn-sm btn-circle"
                        on:click={state.playPrevious}
                        disabled={!$state.currentTrack ||
                            $state.playlist.findIndex(
                                (t) => t.id === $state.currentTrack?.id,
                            ) <= 0}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                            /></svg
                        >
                    </button>

                    <button
                        class="btn btn-primary btn-sm btn-circle"
                        on:click={state.togglePlayPause}
                        disabled={!$state.currentTrack}
                    >
                        {#if $state.isPlaying}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                ><path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M10 9v6m4-6v6"
                                /></svg
                            >
                        {:else}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                ><path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                /><path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                /></svg
                            >
                        {/if}
                    </button>

                    <button
                        class="btn btn-ghost btn-sm btn-circle"
                        on:click={state.playNext}
                        disabled={!$state.currentTrack ||
                            $state.playlist.findIndex(
                                (t) => t.id === $state.currentTrack?.id,
                            ) >=
                                $state.playlist.length - 1}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M13 5l7 7-7 7M5 5l7 7-7 7"
                            /></svg
                        >
                    </button>
                </div>

                <button
                    class="btn btn-ghost btn-sm btn-circle absolute top-0 right-1 translate-y-[-50%] bg-base-300"
                    on:click={state.closePlayer}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                        /></svg
                    >
                </button>
            </div>
        </div>
    </div>
{/if}

<audio
    bind:this={audio}
    on:timeupdate={() =>
        audio && state.updateTime(audio.currentTime, audio.duration)}
    on:loadedmetadata={() =>
        audio && state.updateTime(audio.currentTime, audio.duration)}
    on:ended={state._handleTrackEnd}
    on:error={() => console.error("Audio playback error for:", audio?.src)}
    preload="auto"
></audio>

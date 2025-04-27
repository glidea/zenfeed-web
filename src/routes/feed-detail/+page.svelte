<script lang="ts">
    import { selectedFeed } from "$lib/stores/feedStore";
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n"; // Import translation function

    // Use the reactive $ prefix to subscribe to the store value
    let feedData = $selectedFeed;

    // Handle direct navigation case (store might be empty)
    onMount(() => {
        // If store is empty (likely refresh or direct access), try sessionStorage
        if (!feedData) {
            try {
                const storedDataString =
                    sessionStorage.getItem("selectedFeedDetail");
                if (storedDataString) {
                    const parsedData = JSON.parse(storedDataString);
                    // Update the store, which will update reactive 'feedData'
                    selectedFeed.set(parsedData);
                    // Update local variable immediately if needed before store reaction
                    feedData = parsedData;
                } else {
                    console.warn(
                        "No feed data found in store or sessionStorage.",
                    );
                }
            } catch (e) {
                console.error(
                    "Failed to read or parse feed detail from sessionStorage:",
                    e,
                );
            }
        }

        // Check again if feedData is now populated
        if (!feedData) {
            console.warn(
                "Feed detail page accessed directly without selected feed data.",
            );
        }
    });

    // Function to go back to the previous page (likely the main feed list)
    function goBack() {
        history.back();
    }
</script>

<svelte:head>
    <title>{feedData?.title}</title>
</svelte:head>

<div class="min-h-screen p-4 md:p-8 bg-base-100">
    {#if feedData}
        <div class="max-w-3xl mx-auto">
            <!-- Back Button -->
            <button class="btn btn-ghost btn-sm mb-6" on:click={goBack}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4 mr-1"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
                {$_("feedDetail.backButton")}
            </button>

            <!-- Feed Content Card -->
            <div
                class="card bg-base-200 border border-base-300 shadow-md rounded-lg"
            >
                <div class="card-body p-6">
                    <h1
                        class="card-title text-2xl font-semibold mb-4 break-words"
                    >
                        {feedData.title}
                    </h1>

                    <div
                        class="prose prose-sm max-w-none leading-relaxed mb-6 text-base"
                    >
                        {@html feedData.summaryHtmlSnippet ||
                            $_("feedDetail.noSummary")}
                    </div>

                    <div
                        class="card-actions justify-end border-t border-base-300 pt-4"
                    >
                        <a
                            href={feedData.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="btn btn-primary btn-sm"
                        >
                            {$_("feedDetail.visitSourceButton")}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="w-4 h-4 ml-1.5"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                                />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

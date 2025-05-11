<script lang="ts">
    import { selectedFeedStore, queryFeedsStore } from "$lib/stores/feedStore";
    import { onMount, tick } from "svelte";
    import { _ } from "svelte-i18n"; // Import translation function
    import { shareElementAsImage } from "$lib/utils/shareUtils"; // Import share utility
    import { env } from "$env/dynamic/public"; // Import env
    import { readItemsStore } from "$lib/stores/readStateStore";
    import { fly, fade } from "svelte/transition";
    import { cubicOut, elasticOut } from "svelte/easing";
    import { getFeedItemId, compareFeeds } from "$lib/utils/feedUtils"; // Import getFeedItemId and compareFeeds
    import { get } from "svelte/store"; // Import get function from svelte/store
    import type { FeedVO } from "$lib/types/feed"; // Import FeedVO type

    // Use the reactive $ prefix to subscribe to the store value
    let feedData = $selectedFeedStore;
    let copyStatus: "idle" | "copying" | "copied" | "error" = "idle"; // Copy status state
    let detailCardElement: HTMLDivElement | null = null; // Reference to the card element
    let detailContentElement: HTMLDivElement | null = null; // Reference to the content element
    const siteUrl = env.PUBLIC_SITE_URL; // Get site URL for QR code

    // --- Constants for Session Storage ---
    const SWIPE_GROUP_LABEL_KEY = "zenfeed_swipe_group_label";
    const SWIPE_GROUP_NAME_KEY = "zenfeed_swipe_group_name";
    const SELECTED_FEED_DETAIL_KEY = "selectedFeedDetail";

    // Touch-related variables
    let startY = 0;
    let endY = 0;
    let isDragging = false;
    let translateY = 0;
    let opacity = 1;
    let isTransitioning = false;
    let feedsList: FeedVO[] = []; // Explicitly type as FeedVO array
    let currentFeedIndex = -1;
    let swipeStartTime = 0;
    let autoSlideDuration = 300; // Auto slide animation duration (ms)
    let feedContainer: HTMLDivElement;

    // Function to check if next feed exists
    $: hasNextFeed = currentFeedIndex < feedsList.length - 1;

    // Initialize and get all swipeable feeds
    onMount(async () => {
        // Handle direct navigation case: Load selected feed first
        if (!feedData) {
            try {
                const storedDataString = sessionStorage.getItem(
                    SELECTED_FEED_DETAIL_KEY,
                );
                if (storedDataString) {
                    const parsedData = JSON.parse(storedDataString);
                    selectedFeedStore.set(parsedData);
                    feedData = parsedData;
                }
            } catch (e) {
                console.error(
                    "Failed to read feed detail from sessionStorage:",
                    e,
                );
                // Optionally handle error, e.g., redirect back or show message
            }
        }

        // If feedData is still null after trying to load, we can't proceed
        if (!feedData?.id) {
            console.error("Feed data could not be loaded.");
            // Optionally navigate back or show an error state
            // goBack(); // Example: navigate back if data is missing
            return; // Stop execution if essential data is missing
        }

        // --- Construct the swipeable list (feedsList) ---
        const cachedData = get(queryFeedsStore);
        const readItemsMap = get(readItemsStore);
        const currentFeedId = feedData.id;

        if (cachedData?.feeds) {
            let potentialSwipeList: FeedVO[] = [];
            let swipeGroupLabel: string | null = null;
            let swipeGroupName: string | null = null;

            // Try to get grouping context from sessionStorage
            try {
                swipeGroupLabel = sessionStorage.getItem(SWIPE_GROUP_LABEL_KEY);
                swipeGroupName = sessionStorage.getItem(SWIPE_GROUP_NAME_KEY);
                // console.log("Swipe Context:", swipeGroupLabel, swipeGroupName);
            } catch (e) {
                console.error(
                    "Failed to read swipe context from sessionStorage:",
                    e,
                );
            }

            // 1. Filter by group (if context is available)
            if (swipeGroupLabel && swipeGroupName) {
                const uncategorized = $_("past24h.uncategorizedGroup"); // Get translation for comparison
                potentialSwipeList = cachedData.feeds.filter((feed) => {
                    const groupValue =
                        feed.labels[swipeGroupLabel!] || uncategorized;
                    return groupValue === swipeGroupName;
                });
                // console.log("Filtered by group:", potentialSwipeList.length);
            } else {
                // No group context, use all feeds as the base
                potentialSwipeList = [...cachedData.feeds];
                // console.log("Using all feeds as base:", potentialSwipeList.length);
            }

            // 2. Filter out read items (unless it's the currently viewed item)
            potentialSwipeList = potentialSwipeList.filter((feed) => {
                const feedId = getFeedItemId(feed);
                return !readItemsMap.has(feedId) || feedId === currentFeedId;
            });
            // console.log("Filtered by read status:", potentialSwipeList.length);

            // 3. Sort the list using the same logic as Past24h
            potentialSwipeList.sort(compareFeeds);
            // console.log("Sorted list:", potentialSwipeList.map(f => getFeedItemId(f)));

            // 4. Assign to feedsList
            feedsList = potentialSwipeList;

            // 5. Find the index of the current feed in the final list
            currentFeedIndex = feedsList.findIndex(
                (feed) => getFeedItemId(feed) === currentFeedId,
            );

            // If the current feed wasn't found in the final list (e.g., it was read and not part of the group)
            // This shouldn't normally happen if we include the currentFeedId in the read filter step,
            // but as a fallback, reset index or handle appropriately.
            if (currentFeedIndex === -1) {
                console.warn(
                    "Current feed ID not found in the final swipe list. Resetting index.",
                );
                // Decide fallback: Maybe set to 0 if list not empty, or handle error.
                currentFeedIndex = feedsList.length > 0 ? 0 : -1;
                // If index is 0, update feedData to the first item in the list?
                // if (currentFeedIndex === 0) {
                //     navigateToFeed(0); // Be careful of infinite loops or unwanted navigation
                // }
            }

            // console.log("Final feedsList length:", feedsList.length);
            // console.log("Current feed index:", currentFeedIndex);
        } else {
            console.warn(
                "No cached feed data found for swipe list construction.",
            );
            // Handle case where cache is empty but we are on the detail page.
            // Maybe just include the current feed?
            if (feedData) {
                // Need to reconstruct a FeedVO-like object if feedData is minimal
                // This might be complex. Simplest is likely an empty list.
                feedsList = [];
                currentFeedIndex = -1;
            }
        }
        // --- End Constructing swipeable list ---
    });

    // Handle touch start event
    function handleTouchStart(event: TouchEvent) {
        if (isTransitioning) return;

        startY = event.touches[0].clientY;
        swipeStartTime = Date.now();
        isDragging = true;
        translateY = 0;
        opacity = 1;
    }

    // Handle touch move event
    function handleTouchMove(event: TouchEvent) {
        if (!isDragging || !feedContainer) return; // Add check for feedContainer

        endY = event.touches[0].clientY;
        // Only track endY. Do not modify translateY or opacity here.
        // Let the browser handle page scrolling during move.
        // We will determine action solely on handleTouchEnd.
    }

    // Handle touch end event
    async function handleTouchEnd() {
        if (!isDragging || !feedContainer) return; // Add check for feedContainer
        isDragging = false;

        const swipeDuration = Date.now() - swipeStartTime;
        const swipeDistance = Math.abs(endY - startY);
        const isQuickSwipe = swipeDuration < 300 && swipeDistance > 50;
        // Use viewport height for threshold, adjust multiplier if needed
        const distanceThreshold = window.innerHeight * 0.15;

        // Check if the PAGE is scrolled to bottom
        const isPageScrolledToBottom =
            window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 5; // 5px tolerance for page bottom

        // Check if it was a swipe up
        const isSwipeUp = endY < startY; // Swipe direction check

        // Only trigger next feed if swiping UP, PAGE at the bottom, has next feed, and sufficient movement
        if (
            isSwipeUp &&
            isPageScrolledToBottom &&
            (swipeDistance > distanceThreshold || isQuickSwipe) && // Check swipe distance or quickness
            hasNextFeed // Check if there is a next feed
        ) {
            isTransitioning = true;

            // Animate out upwards
            translateY = -feedContainer.offsetHeight; // Use container height for animation distance
            opacity = 0;

            await new Promise((resolve) =>
                setTimeout(resolve, autoSlideDuration),
            );

            // Mark current feed as read
            if (feedData?.id) {
                readItemsStore.markRead(feedData.id);

                // Remove current item from swipeable list if it's still there
                const currentIndexInList = feedsList.findIndex(
                    (feed) => getFeedItemId(feed) === feedData?.id,
                );
                if (currentIndexInList !== -1) {
                    feedsList.splice(currentIndexInList, 1);
                    // Adjust index if the removed item was before the target next item
                    if (currentIndexInList < currentFeedIndex) {
                        currentFeedIndex--;
                    }
                }
            }

            // Navigate to the actual next feed in the potentially modified list
            if (currentFeedIndex < feedsList.length) {
                navigateToFeed(currentFeedIndex);
            } else if (feedsList.length > 0) {
                navigateToFeed(0);
            } else {
                setTimeout(() => {
                    goBack();
                }, 300);
            }

            // Reset state after navigation MAY start (before key block update)
            // The actual visual reset happens when the #key block re-renders with translateY=0, opacity=1 implicitly
            // Setting these here ensures state consistency if navigation somehow fails or is delayed.
            translateY = 0;
            opacity = 1;
            isTransitioning = false;
        } else {
            // If swipe didn't trigger navigation, do nothing to translateY/opacity.
            // Ensure isDragging is false and state is clean.
            // translateY and opacity should already be 0 and 1 from handleTouchStart or last transition end.
        }
    }

    // Navigate to feed at specified index
    function navigateToFeed(index: number) {
        if (index < 0 || index >= feedsList.length) {
            // If index is invalid (e.g., list became empty unexpectedly), go back
            if (feedsList.length === 0) {
                console.warn(
                    "NavigateToFeed called with empty list, going back.",
                );
                goBack();
                return;
            }
            // Attempt to recover by going to the first item if index is bad but list isn't empty
            console.warn(
                `NavigateToFeed called with invalid index ${index}, attempting to navigate to 0.`,
            );
            index = 0;
            if (index >= feedsList.length) {
                // Double check after resetting index
                goBack();
                return;
            }
        }

        const targetFeed = feedsList[index];
        currentFeedIndex = index; // Update the index to the newly selected feed

        // Prepare feed data
        const feedDetailData = {
            id: getFeedItemId(targetFeed),
            tags: targetFeed.labels.tags || "",
            title: targetFeed.labels.title || $_("past24h.untitledFeed"), // Use translated fallback
            summaryHtmlSnippet: targetFeed.labels.summary_html_snippet || "",
            link: targetFeed.labels.link,
        };

        // Update stores and session storage
        selectedFeedStore.set(feedDetailData);
        try {
            sessionStorage.setItem(
                SELECTED_FEED_DETAIL_KEY, // Use constant
                JSON.stringify(feedDetailData),
            );
        } catch (e) {
            console.error("Failed to save feed detail to sessionStorage:", e);
        }

        // Update local feedData variable REACTIVELY
        feedData = feedDetailData; // This should trigger #key block update

        // Force update title if needed (though svelte:head should handle it)
        // document.title = feedData.title || $_("feedDetail.pageTitle"); // Usually not needed

        // Reset content scroll position AFTER the DOM updates
        tick().then(() => {
            if (detailContentElement) {
                detailContentElement.scrollTop = 0;
            }
            // Reset page scroll position
            window.scrollTo(0, 0);
        });
    }

    // Function to go back to the previous page (likely the main feed list)
    function goBack() {
        history.back();
    }

    // Handle share button click
    async function handleShare() {
        if (!detailCardElement || copyStatus === "copying") {
            return;
        }

        copyStatus = "copying";

        try {
            const result = await shareElementAsImage(
                detailCardElement,
                detailContentElement,
                {
                    qrCodeData: siteUrl,
                    // qrCodePosition: 'center' // You can choose 'center' or 'bottom-right'
                    // excludeSelector: '.share-exclude' // Using default
                },
            );

            copyStatus = result;

            if (result === "copied") {
                setTimeout(() => {
                    copyStatus = "idle";
                }, 1500);
            } else {
                setTimeout(() => {
                    copyStatus = "idle";
                }, 2000);
            }
        } catch (err) {
            console.error("Error sharing feed detail:", err);
            copyStatus = "error";
            setTimeout(() => {
                copyStatus = "idle";
            }, 2000);
        }
    }
</script>

<svelte:head>
    <title>{feedData?.title || $_("feedDetail.pageTitle")}</title>
</svelte:head>

<div
    class="min-h-screen p-4 md:p-8 bg-base-100 relative"
    bind:this={feedContainer}
    on:touchstart|passive={handleTouchStart}
    on:touchmove|passive={handleTouchMove}
    on:touchend|passive={handleTouchEnd}
    on:touchcancel|passive={handleTouchEnd}
>
    {#if feedData}
        {#key feedData.id}
            <div
                class="max-w-3xl mx-auto relative"
                style="transform: translateY({translateY}px); opacity: {opacity}; transition: {isTransitioning
                    ? `transform ${autoSlideDuration}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${autoSlideDuration}ms ease-out`
                    : 'none'};"
            >
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
                    bind:this={detailCardElement}
                    class="card bg-base-200 border border-base-300 shadow-md rounded-lg overflow-hidden mb-12"
                >
                    <div class="card-body p-6">
                        <h1
                            class="card-title text-2xl font-semibold mb-4 break-words"
                        >
                            {feedData.title}
                        </h1>

                        <!-- Inserted Tags Section for Mobile -->
                        {#if feedData.tags && feedData.tags.trim() !== ""}
                            <div
                                class="mb-4"
                                style="font-size:14px; color:#5f6368;"
                            >
                                <span
                                    style="display:inline-block; background-color:rgba(241, 243, 244, 0.65); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); border: 1px solid rgba(255, 255, 255, 0.18); padding:4px 10px; border-radius:15px; margin-right:5px; color:#1a73e8; font-weight:500;"
                                >
                                    {feedData.tags}
                                </span>
                            </div>
                        {/if}

                        <div
                            bind:this={detailContentElement}
                            class="embedded-html-content prose prose-sm max-w-none leading-relaxed mb-6 text-base"
                        >
                            {@html feedData.summaryHtmlSnippet ||
                                $_("feedDetail.noSummary")}
                        </div>

                        <div
                            class="card-actions justify-end border-t border-base-300 pt-4 share-exclude"
                        >
                            {#if feedData.link}
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
                            {/if}

                            <!-- Share Button -->
                            <button
                                class="btn btn-secondary btn-sm"
                                on:click={handleShare}
                                disabled={copyStatus === "copying"}
                                title={$_("past24h.shareTooltip")}
                            >
                                {#if copyStatus === "idle"}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        class="w-4 h-4 mr-1.5"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                                        />
                                    </svg>
                                    {$_("past24h.shareButton")}
                                {:else if copyStatus === "copying"}
                                    <span
                                        class="loading loading-spinner loading-xs mr-1.5"
                                    ></span>
                                    {$_("past24h.copyStatusCopying")}
                                {:else if copyStatus === "copied"}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        class="w-4 h-4 mr-1.5 text-success"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="m4.5 12.75 6 6 9-13.5"
                                        />
                                    </svg>
                                    {$_("past24h.copyStatusCopied")}
                                {:else if copyStatus === "error"}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        class="w-4 h-4 mr-1.5 text-error"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M6 18 18 6M6 6l12 12"
                                        />
                                    </svg>
                                    {$_("past24h.copyStatusError")}
                                {/if}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        {/key}

        <!-- Swipe Down Hint Arrow (Adjusted position) -->
        <div
            class="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-base-content text-opacity-50 animate-bounce z-10 pointer-events-none"
            in:fade={{ duration: 200 }}
            out:fade={{ duration: 150 }}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-6 h-6"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                />
            </svg>
        </div>
    {/if}
</div>

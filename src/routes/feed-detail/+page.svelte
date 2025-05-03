<script lang="ts">
    import { selectedFeedStore, queryFeedsStore } from "$lib/stores/feedStore";
    import { onMount, tick } from "svelte";
    import { _ } from "svelte-i18n"; // Import translation function
    import { shareElementAsImage } from "$lib/utils/shareUtils"; // Import share utility
    import { env } from "$env/dynamic/public"; // Import env
    import { readItemsStore } from "$lib/stores/readStateStore";
    import { fly, fade } from "svelte/transition";
    import { cubicOut, elasticOut } from "svelte/easing";
    import { getFeedItemId } from "$lib/utils/feedUtils";
    import { get } from "svelte/store"; // Import get function from svelte/store

    // Use the reactive $ prefix to subscribe to the store value
    let feedData = $selectedFeedStore;
    let copyStatus: "idle" | "copying" | "copied" | "error" = "idle"; // Copy status state
    let detailCardElement: HTMLDivElement | null = null; // Reference to the card element
    let detailContentElement: HTMLDivElement | null = null; // Reference to the content element
    const siteUrl = env.PUBLIC_SITE_URL; // Get site URL for QR code

    // Touch-related variables
    let startY = 0;
    let endY = 0;
    let isDragging = false;
    let translateY = 0;
    let opacity = 1;
    let isTransitioning = false;
    let showNavigationHint = false;
    let navigateDirection: "prev" | "next" | null = null;
    let feedsList: any[] = [];
    let currentFeedIndex = -1;
    let swipeStartTime = 0;
    let autoSlideDuration = 300; // Auto slide animation duration (ms)
    let feedContainer: HTMLDivElement;
    let hintTimeout: ReturnType<typeof setTimeout>;

    // Function to check if next feed exists
    $: hasNextFeed = currentFeedIndex < feedsList.length - 1;

    // Show navigation hint
    function showHint() {
        if (hintTimeout) clearTimeout(hintTimeout);
        showNavigationHint = true;
        hintTimeout = setTimeout(() => {
            showNavigationHint = false;
        }, 1500);
    }

    // Initialize and get all swipeable feeds
    onMount(async () => {
        // Handle direct navigation case
        if (!feedData) {
            try {
                const storedDataString =
                    sessionStorage.getItem("selectedFeedDetail");
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
            }
        }

        // Get feeds list from cache and filter out read items
        const cachedData = $queryFeedsStore;
        if (cachedData?.feeds && feedData?.id) {
            // Get current read state
            const readItemsMap = get(readItemsStore);

            // Filter out read items
            feedsList = cachedData.feeds.filter((feed) => {
                const feedId = getFeedItemId(feed);
                return !readItemsMap.has(feedId);
            });

            // If current item is not in read list, add it to the swipeable list
            const currentFeedId = feedData.id;
            if (!readItemsMap.has(currentFeedId)) {
                // Find current feed position in filtered list
                currentFeedIndex = feedsList.findIndex(
                    (feed) => getFeedItemId(feed) === currentFeedId,
                );

                // If current feed is not in the list (shouldn't happen, but just in case)
                if (currentFeedIndex === -1) {
                    // Find current feed in original list
                    const currentFeed = cachedData.feeds.find(
                        (feed) => getFeedItemId(feed) === currentFeedId,
                    );

                    if (currentFeed) {
                        // Add current feed to the beginning of the list
                        feedsList.unshift(currentFeed);
                        currentFeedIndex = 0;
                    }
                }
            } else {
                // If current item is read but still viewing, set index to 0 for navigation to other unread items
                currentFeedIndex = 0;
            }
        }

        // Show navigation hint on first load
        await tick();
        showHint();
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
        if (!isDragging) return;

        endY = event.touches[0].clientY;
        const diffY = endY - startY;

        // Determine swipe direction
        if (diffY > 0 && currentFeedIndex > 0) {
            // Swipe down - previous
            navigateDirection = "prev";
            translateY = Math.min(diffY, window.innerHeight * 0.5);
            opacity = 1 - Math.abs(translateY) / (window.innerHeight * 2);
        } else if (diffY < 0 && currentFeedIndex < feedsList.length - 1) {
            // Swipe up - next
            navigateDirection = "next";
            translateY = Math.max(diffY, -window.innerHeight * 0.5);
            opacity = 1 - Math.abs(translateY) / (window.innerHeight * 2);
        } else {
            // Elastic damping effect when no more content
            translateY = diffY * 0.2;
            opacity = 1 - Math.abs(translateY) / (window.innerHeight * 3);
        }
    }

    // Handle touch end event
    async function handleTouchEnd() {
        if (!isDragging) return;
        isDragging = false;

        const swipeDuration = Date.now() - swipeStartTime;
        const swipeDistance = Math.abs(endY - startY);
        const isQuickSwipe = swipeDuration < 300 && swipeDistance > 50;
        const threshold = window.innerHeight * 0.15;

        if (
            (Math.abs(translateY) > threshold || isQuickSwipe) &&
            navigateDirection
        ) {
            isTransitioning = true;

            const targetDirection = navigateDirection === "next" ? -1 : 1;
            translateY = targetDirection * window.innerHeight;
            opacity = 0;

            await new Promise((resolve) =>
                setTimeout(resolve, autoSlideDuration),
            );

            // Mark current feed as read
            if (feedData?.id) {
                readItemsStore.markRead(feedData.id);

                // Remove current item from swipeable list
                if (currentFeedIndex >= 0) {
                    feedsList.splice(currentFeedIndex, 1);
                    // No need to update currentFeedIndex as navigateToFeed will set it
                }
            }

            // Navigate to new feed (based on direction and adjusted list)
            if (
                navigateDirection === "next" &&
                currentFeedIndex < feedsList.length - 1
            ) {
                // No need to +1 since current item was removed
                navigateToFeed(currentFeedIndex);
            } else if (navigateDirection === "prev" && currentFeedIndex > 0) {
                navigateToFeed(currentFeedIndex - 1);
            } else if (feedsList.length > 0) {
                // If last or first item was swiped but list still has other items
                navigateToFeed(0);
            } else {
                // List is empty, go back
                setTimeout(() => {
                    goBack();
                }, 300);
            }

            translateY = 0;
            opacity = 1;
            isTransitioning = false;
        } else {
            translateY = 0;
            opacity = 1;
        }

        navigateDirection = null;
    }

    // Navigate to feed at specified index
    function navigateToFeed(index: number) {
        if (index < 0 || index >= feedsList.length) return;

        const targetFeed = feedsList[index];
        currentFeedIndex = index;

        // Prepare feed data
        const feedDetailData = {
            id: getFeedItemId(targetFeed),
            title: targetFeed.labels.title || $_("past24h.untitledFeed"),
            summaryHtmlSnippet: targetFeed.labels.summary_html_snippet || "",
            link: targetFeed.labels.link,
        };

        // Update stores and session storage
        selectedFeedStore.set(feedDetailData);
        try {
            sessionStorage.setItem(
                "selectedFeedDetail",
                JSON.stringify(feedDetailData),
            );
        } catch (e) {
            console.error("Failed to save feed detail to sessionStorage:", e);
        }

        // Update local feedData variable
        feedData = feedDetailData;

        // Force update title if needed
        document.title = feedData.title || $_("feedDetail.pageTitle");

        // Reset content scroll position
        if (detailContentElement) {
            detailContentElement.scrollTop = 0;
        }

        // Reset page scroll position
        window.scrollTo(0, 0);

        // Show navigation hint
        showHint();
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
    class="min-h-screen p-4 md:p-8 bg-base-100 overflow-hidden relative"
    bind:this={feedContainer}
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
    on:touchcancel={handleTouchEnd}
>
    {#if feedData}
        <!-- Wrap the content block with #key feedData.id -->
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
        {#if !isDragging && !isTransitioning && hasNextFeed}
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
    {/if}
</div>

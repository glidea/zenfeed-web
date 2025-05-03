<script lang="ts">
    import { onMount, tick, onDestroy, afterUpdate } from "svelte"; // Added beforeUpdate, afterUpdate
    import { marked } from "marked";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { _ } from "svelte-i18n";
    import { getTargetApiUrl } from "$lib/utils/apiUtils";
    import { env } from "$env/dynamic/public";
    import { goto } from "$app/navigation";
    import { selectedFeedStore, queryFeedsStore } from "$lib/stores/feedStore"; // Renamed import to avoid conflict
    import { get } from "svelte/store";
    import { shareElementAsImage } from "$lib/utils/shareUtils"; // NEW: Import the utility function
    // --- NEW: Import utility functions ---
    import { getFeedItemId, compareFeeds } from "$lib/utils/feedUtils";
    // import { calculateTodayReadCount } from "$lib/utils/dateUtils"; // REMOVED: Handled by readStateStore
    import type { ReadItemsMap } from "$lib/utils/dateUtils"; // Import type if needed elsewhere
    import { preventScrollChaining } from "$lib/utils/domUtils";
    import type { FeedVO } from "$lib/types/feed"; // Import shared types
    // --- NEW: Import read state store ---
    import {
        readItemsStore,
        todayReadCountStore,
    } from "$lib/stores/readStateStore";

    const disableAddSource = env.PUBLIC_DISABLE_ADD_SOURCE === "true";
    const disableSearchTerm = env.PUBLIC_DISABLE_SEARCH_TERM === "true";
    const siteUrl = env.PUBLIC_SITE_URL; // 新增：获取网站URL

    interface QueryResponse {
        summary: string;
        feeds: FeedVO[];
        count: number;
    }

    interface GroupedFeeds {
        [source: string]: FeedVO[];
    }

    // --- Constants ---
    // const READ_ITEMS_STORAGE_KEY = "zenfeed_read_feeds"; // REMOVED: Handled by readStateStore
    const GROUP_BY_LABEL_STORAGE_KEY = "zenfeed_group_by_label";
    const ACTIVE_GROUP_NAME_STORAGE_KEY = "zenfeed_active_group_name"; // New Key for active tab
    const SCROLL_POSITION_STORAGE_KEY = "zenfeed_scroll_position"; // Key for scroll position
    const NAVIGATING_TO_DETAIL_KEY = "zenfeed_navigating_to_detail"; // NEW: Key for navigation flag
    const SWIPE_GROUP_LABEL_KEY = "zenfeed_swipe_group_label"; // NEW: Key for swipe context
    const SWIPE_GROUP_NAME_KEY = "zenfeed_swipe_group_name"; // NEW: Key for swipe context
    const DEFAULT_GROUP_BY_LABEL =
        env.PUBLIC_DEFAULT_GROUP_BY_LABEL || "source";
    const FEED_TITLE_PREFIX_LABEL = env.PUBLIC_FEED_TITLE_PREFIX_LABEL;
    const LAST_VIEWED_MOBILE_FEED_ID_KEY = "zenfeed_last_viewed_mobile_feed_id"; // NEW Key for item ID to mark on return

    // --- Types ---
    // Remove ReadItemsMap if imported from dateUtils.ts
    // type ReadItemsMap = Map<string, number>; // REMOVED

    // --- Component State ---
    let searchTerm = "";
    let searchResults: QueryResponse | null = null;
    let groupedFeeds: GroupedFeeds = {};
    let isLoading = false;
    let availableGroupByLabels: string[] = [DEFAULT_GROUP_BY_LABEL];
    let selectedGroupByLabel = DEFAULT_GROUP_BY_LABEL;
    let error: string | null = null;
    // let readItems: ReadItemsMap = new Map(); // REMOVED: Use readItemsStore
    let isMobile = false;
    let shouldRestoreScroll = false; // Flag to indicate scroll restoration is needed

    // --- NEW State for Desktop Layout ---
    let initialActiveGroupName: string | null = null; // Store loaded group name temporarily
    let activeGroupName: string | null = null; // Currently selected group tab (desktop)
    let selectedFeedDesktop: FeedVO | null = null; // Feed selected for detail view (desktop)
    let rightPanelHtml = ""; // Parsed HTML for the right panel
    let detailPanelContentElement: HTMLDivElement | null = null; // NEW: Reference to the detail panel's scrollable content area
    let detailCardElement: HTMLDivElement | null = null;
    let copyStatus: "idle" | "copying" | "copied" | "error" = "idle";

    // --- Reactive Derived State ---

    // Add unique IDs to feeds (only needs to happen once after fetch)
    let feedsWithIds: FeedVO[] = [];
    $: if (searchResults?.feeds) {
        feedsWithIds = searchResults.feeds.map((feed) => ({
            ...feed,
            id: getFeedItemId(feed), // Use imported function
        }));
        // Re-group feeds with IDs whenever results or group label changes
        groupFeeds(feedsWithIds, selectedGroupByLabel);
    }

    // Filter out read items (uses feedsWithIds implicitly via groupedFeeds)
    $: filteredGroupedFeeds = filterReadItems(groupedFeeds, $readItemsStore);

    // Calculate the count of items marked read today
    // let todayReadCount = calculateTodayReadCount(readItems); // REMOVED: Use todayReadCountStore
    // Use derived store directly in the template: $todayReadCountStore

    // Sort the groups alphabetically by group name for tabs/display
    $: sortedGroupEntries = Object.entries(filteredGroupedFeeds).sort((a, b) =>
        a[0].localeCompare(b[0]),
    );

    // Update active tab and select first feed if needed
    $: {
        if (sortedGroupEntries.length > 0 && !isLoading) {
            const currentGroupNames = sortedGroupEntries.map(
                (entry) => entry[0],
            );
            let newActiveGroupName: string | null = null; // Use temporary variable
            let groupChanged = false; // Flag to track if the active group changed

            // 1. Try to restore initial active group name from localStorage first
            if (
                initialActiveGroupName &&
                currentGroupNames.includes(initialActiveGroupName)
            ) {
                newActiveGroupName = initialActiveGroupName;
                initialActiveGroupName = null; // Mark as used
                if (newActiveGroupName !== activeGroupName) {
                    groupChanged = true;
                }
            } else {
                // 2. If initial restore failed or wasn't applicable, check current active group validity
                if (
                    activeGroupName &&
                    currentGroupNames.includes(activeGroupName)
                ) {
                    newActiveGroupName = activeGroupName; // Keep current active group
                } else {
                    // 3. If current is also invalid or null, select the first available group
                    newActiveGroupName = currentGroupNames[0];
                    groupChanged = true; // Group definitely changed or initialized
                }
            }

            // 4. Update active group name if it actually changed (saving is now handled in a separate block)
            if (newActiveGroupName !== activeGroupName) {
                activeGroupName = newActiveGroupName;
            }

            // 5. Determine the feeds for the active group
            const currentGroupFeeds = activeGroupName
                ? filteredGroupedFeeds[activeGroupName]
                : [];

            // 6. Update the selected feed
            if (groupChanged) {
                selectedFeedDesktop =
                    currentGroupFeeds && currentGroupFeeds.length > 0
                        ? currentGroupFeeds[0]
                        : null;
            } else if (currentGroupFeeds && currentGroupFeeds.length > 0) {
                // UPDATED: Use $readItemsStore to check if selected is still unread
                const selectedFeedStillExistsAndUnread =
                    selectedFeedDesktop &&
                    currentGroupFeeds.some(
                        (feed) =>
                            getFeedItemId(feed) ===
                                getFeedItemId(selectedFeedDesktop!) &&
                            !$readItemsStore.has(getFeedItemId(feed)), // Check against store
                    );
                if (!selectedFeedStillExistsAndUnread) {
                    // Find the first unread item in the current group if the selected one is gone or read
                    selectedFeedDesktop =
                        currentGroupFeeds.find(
                            (feed) => !$readItemsStore.has(getFeedItemId(feed)),
                        ) || null;
                }
                // If no unread items left, selectedFeedDesktop will become null
            } else {
                selectedFeedDesktop = null;
            }
        } else if (!isLoading) {
            // No groups available or loading finished with no groups
            if (activeGroupName !== null) {
                // Only update if it changes to null
                activeGroupName = null;
                selectedFeedDesktop = null;
                // Removal from storage is handled in the dedicated saving block below
            }
        }
        // Dependencies: sortedGroupEntries, isLoading, filteredGroupedFeeds, $readItemsStore
        // Indirect dependencies: selectedFeedDesktop (read), activeGroupName (read/write), initialActiveGroupName (read)
    }

    // Reactive variable for main search summary HTML
    let summaryHtml = "";
    $: summaryHtml = searchResults?.summary
        ? (marked.parse(searchResults.summary) as string)
        : "";

    // Reactive variable for the right panel detail view HTML
    $: rightPanelHtml = selectedFeedDesktop?.labels?.summary_html_snippet ?? "";

    // NEW: Reset scroll position of the detail panel when the selected feed changes
    $: if (detailPanelContentElement && selectedFeedDesktop) {
        // Checking selectedFeedDesktop ensures this runs when a feed is selected
        // (or changes), not just on initial mount if the element exists but no feed is selected yet.
        detailPanelContentElement.scrollTop = 0;
    }

    // --- Utility Functions ---

    // UPDATED: Accepts readItemsMap from store
    function filterReadItems(
        groups: GroupedFeeds,
        readItemsMap: ReadItemsMap, // Accept the map as argument
    ): GroupedFeeds {
        const filteredGroups: GroupedFeeds = {};
        for (const source in groups) {
            // Use the passed readItemsMap for filtering
            const unreadFeeds = groups[source].filter(
                (feed) => !readItemsMap.has(getFeedItemId(feed)), // Use imported getFeedItemId here too
            );
            if (unreadFeeds.length > 0) {
                filteredGroups[source] = unreadFeeds;
            }
        }
        return filteredGroups;
    }

    // --- Data Fetching & Processing ---

    async function fetchFeeds() {
        isLoading = true;
        error = null;
        searchResults = null;
        groupedFeeds = {};
        feedsWithIds = []; // Reset derived state
        selectedFeedDesktop = null; // Reset selection

        try {
            const now = new Date();
            const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const response = await fetch(getTargetApiUrl("/query"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    start: past24h.toISOString(),
                    end: now.toISOString(),
                    limit: 500,
                    query: searchTerm,
                    summarize: !!searchTerm,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let detail = errorText;
                try {
                    const jsonError = JSON.parse(errorText);
                    detail = jsonError.message || jsonError.error || errorText;
                } catch (_) {
                    /* Ignore */
                }
                throw new Error(
                    $_("past24h.errorApi", {
                        values: { status: response.status, detail: detail },
                    }),
                );
            }

            const data: QueryResponse = await response.json();
            queryFeedsStore.set(data); // NEW: Update the store with fetched data
            searchResults = data; // Update local state (triggers reactive updates)
            updateAvailableLabels(data.feeds);

            // Check for scroll restoration *after* fetch success (if not returning from detail)
            const isReturning =
                sessionStorage.getItem(NAVIGATING_TO_DETAIL_KEY) === "true";
            if (
                !isReturning &&
                typeof sessionStorage !== "undefined" &&
                isMobile
            ) {
                const savedScroll = sessionStorage.getItem(
                    SCROLL_POSITION_STORAGE_KEY,
                );
                if (savedScroll) {
                    shouldRestoreScroll = true;
                }
            }
        } catch (e: any) {
            console.error("Failed to fetch feeds:", e);
            error = e.message || $_("past24h.errorLoadingDefault");
            searchResults = null; // Clear results on error
            queryFeedsStore.set(null); // Clear cache on error
        } finally {
            isLoading = false;
        }
    }

    function updateAvailableLabels(feeds: FeedVO[]) {
        const allLabels = new Set<string>([DEFAULT_GROUP_BY_LABEL]);
        const labelValueCounts: { [key: string]: { [value: string]: number } } =
            {};

        feeds.forEach((feed) => {
            Object.keys(feed.labels).forEach((labelKey) => {
                if (
                    labelKey === "link" ||
                    labelKey === "title" ||
                    labelKey === "summary_html_snippet"
                )
                    return;
                allLabels.add(labelKey);
                const labelValue =
                    feed.labels[labelKey] || $_("past24h.uncategorizedGroup");
                if (!labelValueCounts[labelKey])
                    labelValueCounts[labelKey] = {};
                labelValueCounts[labelKey][labelValue] =
                    (labelValueCounts[labelKey][labelValue] || 0) + 1;
            });
        });

        const usefulLabels = Array.from(allLabels).filter((labelKey) => {
            if (labelKey === DEFAULT_GROUP_BY_LABEL) return true;
            const counts = labelValueCounts[labelKey];
            if (!counts) return false;
            return Object.values(counts).some((count) => count > 1);
        });

        availableGroupByLabels = usefulLabels.sort();

        if (!availableGroupByLabels.includes(selectedGroupByLabel)) {
            console.warn(
                `Selected group label "${selectedGroupByLabel}" no longer valid. Resetting to "${DEFAULT_GROUP_BY_LABEL}".`,
            );
            selectedGroupByLabel = DEFAULT_GROUP_BY_LABEL;
            // Save the reset value directly
            if (typeof localStorage !== "undefined") {
                try {
                    localStorage.setItem(
                        GROUP_BY_LABEL_STORAGE_KEY,
                        selectedGroupByLabel,
                    );
                } catch (e) {
                    console.error(
                        "Failed to save reset group by preference:",
                        e,
                    );
                }
            }
        }
    }

    function groupFeeds(feeds: FeedVO[], groupByKey: string) {
        const groups: GroupedFeeds = {};
        feeds.forEach((feed) => {
            const groupValue =
                feed.labels[groupByKey] || $_("past24h.uncategorizedGroup");
            if (!groups[groupValue]) groups[groupValue] = [];
            groups[groupValue].push(feed);
        });

        for (const groupValue in groups) {
            groups[groupValue].sort(compareFeeds); // Use imported function
        }
        groupedFeeds = groups; // Update the base grouped feeds
    }

    // --- NEW: Reactive block specifically for saving activeGroupName ---
    $: {
        if (typeof localStorage !== "undefined") {
            try {
                if (activeGroupName) {
                    localStorage.setItem(
                        ACTIVE_GROUP_NAME_STORAGE_KEY,
                        activeGroupName,
                    );
                }
                // Removal is handled implicitly when activeGroupName becomes null elsewhere
                // else {
                //     localStorage.removeItem(ACTIVE_GROUP_NAME_STORAGE_KEY);
                // }
            } catch (e) {
                console.error(
                    "Failed to save active group name preference:",
                    e,
                );
            }
        }
    }

    function handleSearch() {
        if (isLoading) return;
        queryFeedsStore.set(null); // NEW: Clear cache on new search
        fetchFeeds();
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            handleSearch();
        }
    }

    // --- Item Interaction Handlers ---

    // RENAMED and UPDATED: Now uses readItemsStore.markRead and handles desktop selection logic
    function handleMarkReadAndSelectNextDesktop(itemId: string) {
        // Use the store to mark as read (handles sound, saving, updating the map)
        readItemsStore.markRead(itemId);

        // --- Find the next feed to select (Desktop only) ---
        let nextSelectedFeed: FeedVO | null = null;
        if (!isMobile && activeGroupName && groupedFeeds[activeGroupName]) {
            const currentGroupOriginalFeeds = groupedFeeds[activeGroupName]; // Use the *original* list for finding index
            const markedIndex = currentGroupOriginalFeeds.findIndex(
                (feed) => getFeedItemId(feed) === itemId,
            );

            if (markedIndex !== -1) {
                // Use the *latest* read map from the store ($readItemsStore) to find the *next unread*
                const currentReadMap = get(readItemsStore); // Get current map snapshot

                // Try finding the next *unread* item in the current group
                for (
                    let i = markedIndex + 1;
                    i < currentGroupOriginalFeeds.length;
                    i++
                ) {
                    const potentialNextFeed = currentGroupOriginalFeeds[i];
                    if (!currentReadMap.has(getFeedItemId(potentialNextFeed))) {
                        // Check against latest map
                        nextSelectedFeed = potentialNextFeed;
                        break;
                    }
                }

                // If no next unread item, try finding the previous *unread* item
                if (!nextSelectedFeed) {
                    for (let i = markedIndex - 1; i >= 0; i--) {
                        const potentialPrevFeed = currentGroupOriginalFeeds[i];
                        if (
                            !currentReadMap.has(
                                getFeedItemId(potentialPrevFeed),
                            )
                        ) {
                            // Check against latest map
                            nextSelectedFeed = potentialPrevFeed;
                            break;
                        }
                    }
                }
                // If still no unread item found (neither next nor previous),
                // nextSelectedFeed remains null, which will clear the detail panel.
            } else {
                // If the marked item wasn't found (edge case?), keep selection unless it was the marked one
                if (
                    selectedFeedDesktop &&
                    getFeedItemId(selectedFeedDesktop) === itemId
                ) {
                    nextSelectedFeed = null; // Clear selection if the missing item was the selected one
                } else {
                    nextSelectedFeed = selectedFeedDesktop; // Keep existing selection
                }
            }
            selectedFeedDesktop = nextSelectedFeed; // Update selection
        }
        // No need to save read items here, store handles it.
    }

    // NEW: Select feed for desktop detail view
    function selectFeedForDetail(event: MouseEvent, feed: FeedVO) {
        event.preventDefault(); // Prevent default link navigation on desktop
        selectedFeedDesktop = feed;
    }

    // Mobile click handler (unchanged, navigates)
    function handleFeedClickMobile(event: MouseEvent, feed: FeedVO) {
        event.preventDefault();
        const itemId = getFeedItemId(feed); // Use imported getFeedItemId

        // --- SAVE SCROLL POSITION & NAVIGATION CONTEXT ---
        if (
            isMobile &&
            typeof window !== "undefined" &&
            typeof sessionStorage !== "undefined"
        ) {
            try {
                sessionStorage.setItem(
                    SCROLL_POSITION_STORAGE_KEY,
                    String(window.scrollY),
                );
                sessionStorage.setItem(NAVIGATING_TO_DETAIL_KEY, "true"); // Set navigation flag

                // --- NEW: Store grouping context for swiping ---
                const groupName =
                    feed.labels[selectedGroupByLabel] ||
                    $_("past24h.uncategorizedGroup");
                sessionStorage.setItem(
                    SWIPE_GROUP_LABEL_KEY,
                    selectedGroupByLabel,
                );
                sessionStorage.setItem(SWIPE_GROUP_NAME_KEY, groupName);
                // --- END NEW ---
            } catch (e) {
                console.error(
                    "Failed to save scroll/navigation/group state to sessionStorage:",
                    e,
                );
            }
        }
        // --- END SAVE ---

        const feedDetailData = {
            id: itemId, // Pass the ID as well
            title: feed.labels.title || $_("past24h.untitledFeed"),
            summaryHtmlSnippet: feed.labels.summary_html_snippet || "",
            link: feed.labels.link,
            // Add other data if needed
        };

        selectedFeedStore.set(feedDetailData);

        try {
            sessionStorage.setItem(
                "selectedFeedDetail",
                JSON.stringify(feedDetailData),
            );
            // --- STORE ITEM ID TO MARK ON RETURN ---
            sessionStorage.setItem(LAST_VIEWED_MOBILE_FEED_ID_KEY, itemId); // Store the ID
        } catch (e) {
            console.error(
                "Failed to save feed detail/ID to sessionStorage:",
                e,
            );
        }

        goto("/feed-detail");
    }

    // Context menu handler (UPDATED: Use new function name)
    function handleMarkAsRead(event: MouseEvent, feed: FeedVO) {
        event.preventDefault();
        handleMarkReadAndSelectNextDesktop(getFeedItemId(feed)); // Use new function
    }

    // Custom transition (unchanged)
    function shrinkFadeOut(
        node: HTMLElement,
        { delay = 0, duration = 500, easing = cubicOut },
    ) {
        const style = getComputedStyle(node);
        const originalOpacity = +style.opacity;
        const originalHeight = node.offsetHeight;
        const originalMarginTop = parseFloat(style.marginTop);
        const originalMarginBottom = parseFloat(style.marginBottom);
        const originalPaddingTop = parseFloat(style.paddingTop);
        const originalPaddingBottom = parseFloat(style.paddingBottom);
        const originalTransform =
            style.transform === "none" ? "" : style.transform;

        return {
            delay,
            duration,
            easing,
            css: (t: number, u: number) => `
                opacity: ${u * originalOpacity};
                transform: ${originalTransform} scaleY(${u});
                transform-origin: top;
                height: ${u * originalHeight}px;
                margin-top: ${u * originalMarginTop}px;
                margin-bottom: ${u * originalMarginBottom}px;
                padding-top: ${u * originalPaddingTop}px;
                padding-bottom: ${u * originalPaddingBottom}px;
                overflow: hidden;
                box-shadow: 0px ${u * 4}px ${u * 6}px -${u * 1}px rgba(0, 0, 0, ${u * 0.1}), 0px ${u * 2}px ${u * 4}px -${u * 2}px rgba(0, 0, 0, ${u * 0.1});
            `,
        };
    }

    // --- 处理分享为图片的功能 ---
    async function handleShareAsImage() {
        if (!detailCardElement || copyStatus === "copying") {
            console.warn("Share cancelled: No element or already copying.");
            return;
        }

        copyStatus = "copying";

        try {
            // Call the reusable utility function
            const result = await shareElementAsImage(
                detailCardElement, // Element to capture
                detailPanelContentElement, // Scrollable content inside
                {
                    qrCodeData: siteUrl, // Options: include QR code with site URL
                    // excludeSelector: '.share-exclude' // Using default, so no need to specify here unless changing it
                },
            );

            copyStatus = result; // Update status based on the result ('copied' or 'error')

            // Set timeout to reset status
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
            console.error("Error during share process:", err);
            copyStatus = "error";
            setTimeout(() => {
                copyStatus = "idle";
            }, 2000);
        }
    }

    // --- Lifecycle ---

    onMount(() => {
        // --- Mobile Detection ---
        if (typeof window !== "undefined" && window.matchMedia) {
            const mediaQueryList = window.matchMedia("(max-width: 767px)");
            isMobile = mediaQueryList.matches;
            const updateMobileStatus = (e: MediaQueryListEvent) => {
                const wasMobile = isMobile;
                isMobile = e.matches;
                if (
                    wasMobile &&
                    !isMobile &&
                    typeof sessionStorage !== "undefined"
                ) {
                    sessionStorage.removeItem(SCROLL_POSITION_STORAGE_KEY);
                    shouldRestoreScroll = false;
                }
            };
            mediaQueryList.addEventListener("change", updateMobileStatus);
            onDestroy(() =>
                mediaQueryList.removeEventListener(
                    "change",
                    updateMobileStatus,
                ),
            );
        }

        let cacheHit = false;
        let markItemFromDetailId: string | null = null; // Temporary store for ID to mark on return

        // --- Check if returning from detail page (Mobile) ---
        if (typeof sessionStorage !== "undefined") {
            const isReturning =
                sessionStorage.getItem(NAVIGATING_TO_DETAIL_KEY) === "true";
            if (isReturning) {
                sessionStorage.removeItem(NAVIGATING_TO_DETAIL_KEY); // Clean up flag

                // Try loading from cache first
                const cachedData = get(queryFeedsStore);
                if (cachedData) {
                    console.log("Loading feeds from cache on return.");
                    searchResults = cachedData; // This triggers reactive updates
                    isLoading = false;
                    cacheHit = true;

                    // Check for scroll restoration (should happen after cache load)
                    const savedScroll = sessionStorage.getItem(
                        SCROLL_POSITION_STORAGE_KEY,
                    );
                    if (savedScroll) {
                        shouldRestoreScroll = true; // Flag for afterUpdate
                    } else {
                        window.scrollTo(0, 0);
                    }

                    // --- Get the ID to mark read (from sessionStorage) ---
                    try {
                        markItemFromDetailId = sessionStorage.getItem(
                            LAST_VIEWED_MOBILE_FEED_ID_KEY,
                        );
                        if (markItemFromDetailId) {
                            sessionStorage.removeItem(
                                LAST_VIEWED_MOBILE_FEED_ID_KEY,
                            ); // Clean up immediately
                            console.log(
                                "Found item to mark on return (from cache):",
                                markItemFromDetailId,
                            );
                        }
                    } catch (e) {
                        console.error(
                            "Failed access sessionStorage for mark on return (cache path):",
                            e,
                        );
                        markItemFromDetailId = null; // Ensure it's null on error
                    }
                } else {
                    console.log(
                        "Returning, but cache is empty. Fetching fresh data.",
                    );
                    // If cache is empty even when returning, proceed to fetch fresh data below
                }
            } else {
                // Not returning from detail view
            }
        }

        // --- Load Preferences ---
        try {
            const savedGroupLabel = localStorage.getItem(
                GROUP_BY_LABEL_STORAGE_KEY,
            );
            if (savedGroupLabel) selectedGroupByLabel = savedGroupLabel;
        } catch (e) {
            console.error("Failed to load group by preference:", e);
        }

        try {
            const savedActiveGroupName = localStorage.getItem(
                ACTIVE_GROUP_NAME_STORAGE_KEY,
            );
            if (savedActiveGroupName)
                initialActiveGroupName = savedActiveGroupName;
        } catch (e) {
            console.error("Failed to load active group name preference:", e);
        }

        // --- Mark item read from detail page (if applicable and cache was hit) ---
        if (markItemFromDetailId && cacheHit) {
            const idToMark = markItemFromDetailId; // Use local copy
            markItemFromDetailId = null; // Clear temporary variable

            // Use tick to ensure reactive updates from searchResults have propagated
            // and the feed list (feedsWithIds) is populated from the cache.
            tick().then(() => {
                // Check if the item exists in the list before marking
                if (feedsWithIds.some((f) => getFeedItemId(f) === idToMark)) {
                    // Check if not already marked by the store (though unlikely just after return)
                    if (!get(readItemsStore).has(idToMark)) {
                        console.log(
                            "Marking item on return (after cache load & tick):",
                            idToMark,
                        );
                        readItemsStore.markRead(idToMark);
                    } else {
                        console.log(
                            "Item to mark on return already marked:",
                            idToMark,
                        );
                    }
                } else {
                    console.warn(
                        "Item to mark on return not found in cached feed list:",
                        idToMark,
                    );
                }
            });
        }

        // --- Fetch initial data ONLY if cache was not hit ---
        if (!cacheHit) {
            fetchFeeds();
        } else {
            // If cache was hit, ensure labels are processed
            if (searchResults?.feeds) {
                updateAvailableLabels(searchResults.feeds);
                // Ensure grouping happens by triggering reactivity
                feedsWithIds = searchResults.feeds.map((feed) => ({
                    ...feed,
                    id: getFeedItemId(feed),
                }));
            }
        }
    });

    // --- afterUpdate for scroll restoration --- (Keep as is)
    afterUpdate(() => {
        if (
            shouldRestoreScroll &&
            isMobile &&
            typeof window !== "undefined" &&
            typeof sessionStorage !== "undefined"
        ) {
            const savedScroll = sessionStorage.getItem(
                SCROLL_POSITION_STORAGE_KEY,
            );
            const scrollPosition = parseInt(savedScroll || "0", 10);
            if (!isNaN(scrollPosition) && scrollPosition > 0) {
                Promise.resolve().then(() => {
                    window.scrollTo(0, scrollPosition);
                    console.log("Scroll restored to:", scrollPosition);
                });
            }
            sessionStorage.removeItem(SCROLL_POSITION_STORAGE_KEY);
            shouldRestoreScroll = false;
        }
    });

    // No onDestroy needed for tooltip timeout anymore
</script>

<div
    class="from-base-100 via-base-200/50 to-base-100 min-h-screen space-y-6 bg-gradient-to-br p-4 md:p-8 relative"
>
    <!-- Add Source Button -->
    {#if !disableAddSource}
        <div class="absolute top-4 right-4 md:top-8 md:right-8 z-10">
            <a
                href="/settings/sources"
                class="btn btn-outline btn-primary btn-sm rounded-lg"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="h-4 w-4 mr-1.5"
                    ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                    /></svg
                >
                {$_("past24h.addSourceButton")}
            </a>
        </div>
    {/if}

    <!-- Search Section -->
    <div class="flex flex-wrap items-center gap-3">
        <!-- Group By Dropdown -->
        {#if availableGroupByLabels.length > 1 && !isLoading}
            <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-base-content/80"
                    >{$_("past24h.groupByLabel")}:</span
                >
                <div class="dropdown dropdown-end">
                    <div
                        tabindex="0"
                        role="button"
                        class="btn btn-sm btn-outline btn-neutral min-w-[8rem] h-10 justify-between font-normal"
                    >
                        <span class="text-lg text-base-content/80"
                            >{selectedGroupByLabel}</span
                        >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="w-3 h-3 opacity-70"
                            ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="m19.5 8.25-7.5 7.5-7.5-7.5"
                            /></svg
                        >
                    </div>
                    <ul
                        tabindex="0"
                        class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32 mt-1 max-h-60 overflow-y-auto"
                    >
                        {#each availableGroupByLabels as labelKey}
                            <li>
                                <a
                                    href="#"
                                    role="button"
                                    class:active={selectedGroupByLabel ===
                                        labelKey}
                                    on:click|preventDefault={() => {
                                        if (selectedGroupByLabel !== labelKey) {
                                            selectedGroupByLabel = labelKey;
                                            // Save directly on selection
                                            if (
                                                typeof localStorage !==
                                                "undefined"
                                            ) {
                                                try {
                                                    localStorage.setItem(
                                                        GROUP_BY_LABEL_STORAGE_KEY,
                                                        selectedGroupByLabel,
                                                    );
                                                } catch (e) {
                                                    console.error(
                                                        "Failed to save group by preference:",
                                                        e,
                                                    );
                                                }
                                            }
                                            // Optionally reset active tab when group label changes,
                                            // though the main reactive block might handle this implicitly.
                                            // activeGroupName = null; // Might cause flicker, test if needed
                                        }
                                        // Dropdown closes automatically
                                    }}>{labelKey}</a
                                >
                            </li>
                        {/each}
                    </ul>
                </div>
            </div>
        {/if}

        <!-- Centered Search Input and Button -->
        {#if !disableSearchTerm}
            <div class="mx-auto flex flex-1 items-center gap-3">
                <input
                    type="search"
                    placeholder={$_("past24h.searchPlaceholder")}
                    class="input input-bordered input-primary focus:ring-primary focus:border-primary w-full max-w-lg rounded-lg px-4 py-2.5 text-base focus:ring-2 focus:outline-none"
                    bind:value={searchTerm}
                    on:keydown={handleKeydown}
                    disabled={isLoading}
                />
                <button
                    class="btn btn-primary rounded-lg"
                    on:click={handleSearch}
                    disabled={isLoading}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="h-5 w-5"
                        ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                        /></svg
                    >
                    <span class="ml-1.5 hidden sm:inline"
                        >{$_("past24h.searchButton")}</span
                    >
                </button>
                {#if !isLoading && (searchTerm || (searchResults && Object.keys(groupedFeeds).length === 0 && !searchTerm))}
                    <button
                        class="btn btn-ghost rounded-lg"
                        on:click={() => {
                            searchTerm = "";
                            handleSearch();
                        }}
                        title={$_("past24h.backButtonTitle")}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="h-5 w-5"
                            ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                            /></svg
                        >
                        <span class="ml-1.5 hidden sm:inline"
                            >{$_("past24h.backButton")}</span
                        >
                    </button>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Search Summary Section -->
    {#if !isLoading && searchTerm && searchResults && searchResults.summary}
        <div class="card border-primary/40 rounded-lg border shadow-md">
            <div class="card-body p-5">
                <h2 class="card-title text-lg font-medium">
                    {$_("past24h.aiSummaryTitle")}
                </h2>
                <div
                    class="prose prose-sm max-w-none leading-relaxed text-base"
                >
                    {@html summaryHtml}
                </div>
            </div>
        </div>
    {/if}

    <!-- Main Content Area: Conditional Layout -->
    <div class="mt-8 rounded-lg">
        {#if isLoading}
            <div
                class="flex h-full min-h-[350px] items-center justify-center p-10 text-center"
            >
                <div class="flex flex-col items-center">
                    <span
                        class="loading loading-lg loading-spinner text-primary"
                    ></span>
                    <p class="text-primary mt-4 text-lg font-medium">
                        {$_("past24h.loading")}
                    </p>
                </div>
            </div>
        {:else if error}
            <div class="alert alert-error rounded-lg shadow-lg">
                <div class="flex items-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="text-error-content h-6 w-6 flex-shrink-0 stroke-current"
                        fill="none"
                        viewBox="0 0 24 24"
                        ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        /></svg
                    >
                    <span class="text-error-content ml-2 font-semibold"
                        >{$_("past24h.errorPrefix")}</span
                    >
                    <span class="text-error-content ml-1">{error}</span>
                </div>
            </div>
        {:else if Object.keys(filteredGroupedFeeds).length === 0}
            <!-- Combined Empty State (No Results / All Read) -->
            <div
                class="border-base-300 bg-base-200 flex h-full min-h-[350px] flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="text-primary/60 mb-5 h-16 w-16"
                    aria-hidden="true"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                </svg>
                <p class="text-neutral-focus mb-2 text-lg font-semibold">
                    {#if searchTerm}
                        {$_("past24h.emptyStateSearch", {
                            values: { searchTerm: searchTerm },
                        })}
                    {:else if Object.keys(groupedFeeds).length > 0 && Object.keys(filteredGroupedFeeds).length === 0}
                        {$_("past24h.emptyStateAllRead")}
                    {:else}
                        {$_("past24h.emptyStateNoFeeds")}
                    {/if}
                </p>
                <p class="text-neutral/80 mb-6 text-sm">
                    {#if searchTerm}
                        {$_("past24h.emptyStateSearchHint")}
                    {:else if Object.keys(groupedFeeds).length > 0 && Object.keys(filteredGroupedFeeds).length === 0}
                        {$_("past24h.emptyStateAllReadHint")}
                    {:else}
                        {$_("past24h.emptyStateNoFeedsHint")}
                    {/if}
                </p>
            </div>
        {:else}
            <!-- DESKTOP: Two Column Layout (md and up) -->
            <div class="hidden md:flex md:gap-6 lg:gap-8">
                <!-- Left Column: Tabs + Feed List -->
                <div class="md:w-1/3 lg:w-2/5 flex flex-col">
                    <!-- Tabs for Groups -->
                    {#if sortedGroupEntries.length > 1}
                        <div
                            role="tablist"
                            class="tabs tabs-lifted tabs-sm mb-4 -mt-2"
                        >
                            {#each sortedGroupEntries as [groupName, feeds] (groupName)}
                                <button
                                    role="tab"
                                    class="tab [--tab-bg:oklch(var(--b2))] [--tab-border-color:oklch(var(--b3))] [--tab-color:oklch(var(--nc))] font-medium"
                                    class:tab-active={activeGroupName ===
                                        groupName}
                                    class:!text-primary={activeGroupName ===
                                        groupName}
                                    on:click={() => {
                                        if (activeGroupName !== groupName) {
                                            activeGroupName = groupName;
                                            // Find the first *unread* feed in the new group
                                            const firstUnread =
                                                feeds.find(
                                                    (f) =>
                                                        !$readItemsStore.has(
                                                            getFeedItemId(f),
                                                        ),
                                                ) || null;
                                            selectedFeedDesktop = firstUnread;
                                        }
                                    }}
                                >
                                    <span
                                        class="truncate max-w-[100px] lg:max-w-[150px]"
                                        title={groupName}
                                    >
                                        {groupName}
                                    </span>
                                    <span class="ml-1.5 text-xs opacity-60"
                                        >({feeds.length})</span
                                    >
                                </button>
                            {/each}
                            <!-- Filler tab for style -->
                            <a
                                role="tab"
                                class="tab flex-1 cursor-default [--tab-border-color:oklch(var(--b3))]"
                            ></a>
                        </div>
                    {/if}

                    <!-- Feed List for Active Group -->
                    <div
                        class="flex-1 bg-base-100 border border-base-300 rounded-lg p-3 overflow-y-auto shadow-inner max-h-[65vh]"
                        on:wheel={preventScrollChaining}
                    >
                        {#if activeGroupName && filteredGroupedFeeds[activeGroupName]}
                            <ul class="list-none space-y-1.5 text-sm">
                                {#each filteredGroupedFeeds[activeGroupName] as feed (getFeedItemId(feed))}
                                    <li
                                        class="rounded-md transition-colors duration-150 ease-in-out"
                                        class:bg-base-300={selectedFeedDesktop &&
                                            getFeedItemId(
                                                selectedFeedDesktop,
                                            ) === getFeedItemId(feed)}
                                        on:contextmenu={(e) =>
                                            handleMarkAsRead(e, feed)}
                                        out:shrinkFadeOut={{ duration: 400 }}
                                    >
                                        <a
                                            href={feed.labels.link}
                                            class="block p-2 rounded-md hover:bg-base-200 cursor-pointer"
                                            class:font-semibold={selectedFeedDesktop &&
                                                getFeedItemId(
                                                    selectedFeedDesktop,
                                                ) === getFeedItemId(feed)}
                                            rel="noopener noreferrer"
                                            title={$_("past24h.markAsReadHint")}
                                            on:click={(e) =>
                                                selectFeedForDetail(e, feed)}
                                        >
                                            {#if FEED_TITLE_PREFIX_LABEL && FEED_TITLE_PREFIX_LABEL !== selectedGroupByLabel && feed.labels[FEED_TITLE_PREFIX_LABEL]}
                                                <span class="mr-1 opacity-60"
                                                    >[{feed.labels[
                                                        FEED_TITLE_PREFIX_LABEL
                                                    ]}]</span
                                                >
                                            {/if}
                                            <span
                                                class="break-words line-clamp-2 leading-tight"
                                            >
                                                {feed.labels.title ||
                                                    $_("past24h.untitledFeed")}
                                            </span>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {:else if activeGroupName}
                            <p class="text-center text-neutral-content/60 p-4">
                                {$_("past24h.noItemsInGroup")}
                            </p>
                        {/if}
                    </div>
                </div>

                <!-- Right Column: Selected Feed Detail -->
                <div class="md:w-2/3 lg:w-3/5">
                    <div class="sticky top-8">
                        {#if selectedFeedDesktop}
                            <div
                                bind:this={detailCardElement}
                                class="card relative bg-base-100 border border-base-300 shadow-lg rounded-xl overflow-hidden"
                            >
                                <div class="card-body p-5 lg:p-6">
                                    <h2
                                        class="card-title text-lg lg:text-xl font-semibold mb-3 break-words"
                                    >
                                        {selectedFeedDesktop.labels.title ||
                                            $_("past24h.untitledFeed")}
                                    </h2>
                                    <!-- Container for Link and Share Button - ADD share-exclude class -->
                                    <div
                                        class="flex items-center gap-4 mb-4 share-exclude"
                                    >
                                        {#if selectedFeedDesktop.labels.link}
                                            <a
                                                href={selectedFeedDesktop.labels
                                                    .link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="link-primary text-xs lg:text-sm inline-flex items-center"
                                                tabindex="-1"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 20 20"
                                                    fill="currentColor"
                                                    class="w-4 h-4 mr-1 opacity-70"
                                                >
                                                    <path
                                                        fill-rule="evenodd"
                                                        d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z"
                                                        clip-rule="evenodd"
                                                    />
                                                    <path
                                                        fill-rule="evenodd"
                                                        d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.19a.75.75 0 0 0 .053 1.06Z"
                                                        clip-rule="evenodd"
                                                    />
                                                </svg>
                                                {$_("past24h.fullArticle")}
                                            </a>
                                        {/if}

                                        <!-- Share Button -->
                                        <button
                                            class="btn btn-xs btn-outline btn-secondary rounded"
                                            on:click={handleShareAsImage}
                                            disabled={copyStatus === "copying"}
                                            title={$_("past24h.shareTooltip")}
                                            tabindex="-1"
                                        >
                                            {#if copyStatus === "idle"}
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke-width="1.5"
                                                    stroke="currentColor"
                                                    class="w-3 h-3 mr-1"
                                                    ><path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                                                    /></svg
                                                >
                                                {$_("past24h.shareButton")}
                                            {:else if copyStatus === "copying"}
                                                <span
                                                    class="loading loading-spinner loading-xs mr-1"
                                                ></span>
                                                {$_(
                                                    "past24h.copyStatusCopying",
                                                )}
                                            {:else if copyStatus === "copied"}
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke-width="1.5"
                                                    stroke="currentColor"
                                                    class="w-3 h-3 mr-1 text-success"
                                                    ><path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        d="m4.5 12.75 6 6 9-13.5"
                                                    /></svg
                                                >
                                                {$_("past24h.copyStatusCopied")}
                                            {:else if copyStatus === "error"}
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke-width="1.5"
                                                    stroke="currentColor"
                                                    class="w-3 h-3 mr-1 text-error"
                                                    ><path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        d="M6 18 18 6M6 6l12 12"
                                                    /></svg
                                                >
                                                {$_("past24h.copyStatusError")}
                                            {/if}
                                        </button>
                                    </div>

                                    <!-- Original Content Area -->
                                    <div
                                        bind:this={detailPanelContentElement}
                                        class="embedded-html-content prose prose-sm max-w-none leading-relaxed overflow-y-auto max-h-[60vh]"
                                        on:wheel={preventScrollChaining}
                                    >
                                        {@html rightPanelHtml ||
                                            '<p class="italic text-neutral-content/50">' +
                                                $_(
                                                    "past24h.noSummaryAvailable",
                                                ) +
                                                "</p>"}
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div
                                class="flex flex-col items-center justify-center h-96 border border-dashed border-base-300 rounded-xl bg-base-200/50 text-center p-8"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="w-12 h-12 text-neutral-content/40 mb-4"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25V21L12 17.25 15.75 21V14.25h2.25A1.5 1.5 0 0 1 19.5 12.75Z"
                                    />
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5A2.25 2.25 0 0 1 19.5 6.75v10.5A2.25 2.25 0 0 1 17.25 19.5H6.75A2.25 2.25 0 0 1 4.5 17.25V6.75Z M4.5 4.5v.75"
                                    />
                                </svg>

                                <p
                                    class="text-lg font-semibold text-neutral-content/80"
                                >
                                    {$_("past24h.selectFeedPrompt")}
                                </p>
                                <p class="text-sm text-neutral-content/60">
                                    {$_("past24h.selectFeedHint")}
                                </p>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- MOBILE: Card Grid Layout (fallback for md down) -->
            <div class="grid grid-cols-1 gap-6 md:hidden">
                {#each sortedGroupEntries as [groupName, feeds] (groupName)}
                    <div
                        class="card bg-base-100 border-base-300 rounded-xl border shadow-lg transition-all duration-300 hover:shadow-xl"
                    >
                        <div class="card-body p-5">
                            <h2
                                class="card-title mb-3 truncate text-base font-semibold"
                                title={groupName}
                            >
                                {groupName}
                            </h2>
                            <ul
                                class="list-none space-y-2.5 overflow-y-auto pr-1 text-sm"
                                style="max-height: 240px;"
                            >
                                {#each feeds as feed (getFeedItemId(feed))}
                                    <li
                                        class="truncate"
                                        on:contextmenu={(e) =>
                                            handleMarkAsRead(e, feed)}
                                        out:shrinkFadeOut={{ duration: 500 }}
                                        title={feed.labels.title ||
                                            $_("past24h.untitledFeed")}
                                    >
                                        <a
                                            href={feed.labels.link}
                                            rel="noopener noreferrer"
                                            class="text-primary hover:text-secondary break-words hover:underline"
                                            on:click={(e) =>
                                                handleFeedClickMobile(e, feed)}
                                        >
                                            {#if FEED_TITLE_PREFIX_LABEL && FEED_TITLE_PREFIX_LABEL !== selectedGroupByLabel && feed.labels[FEED_TITLE_PREFIX_LABEL]}
                                                <span class="mr-1 opacity-60"
                                                    >[{feed.labels[
                                                        FEED_TITLE_PREFIX_LABEL
                                                    ]}]</span
                                                >
                                            {/if}
                                            {feed.labels.title ||
                                                $_("past24h.untitledFeed")}
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Tooltip Element - REMOVED as right panel replaces it on desktop -->

    <!-- MCP Client Hint -->
    {#if !isLoading && searchTerm && searchResults && searchResults.summary}
        <div class="mt-8 text-center pb-16">
            <p class="text-neutral-content/100 text-sm">
                {@html $_("past24h.mcpHint", {
                    values: {
                        cherryStudioLink: `<a href="https://github.com/glidea/zenfeed/blob/main/docs/cherry-studio-mcp.md" target="_blank" rel="noopener noreferrer" class="link link-secondary">Cherry Studio</a>`,
                    },
                })}
            </p>
        </div>
    {/if}

    <!-- Bottom Center Read Count: UPDATED to use store -->
    {#if $todayReadCountStore > 0}
        <div
            class="fixed bottom-5 left-1/2 transform -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white shadow-lg backdrop-blur-sm flex items-center space-x-2 text-sm font-bold transition-all duration-300 ease-out select-none"
            in:fly={{ y: 20, duration: 400, easing: cubicOut }}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="w-5 h-5 opacity-90"
                ><path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                    clip-rule="evenodd"
                /></svg
            >
            <span class="font-normal">{$_("past24h.todayReadPrefix")}</span>
            {#key $todayReadCountStore}
                <span
                    class="inline-block min-w-[1.5ch] text-center text-lg font-extrabold bg-white/20 px-1.5 rounded-md"
                    in:fly={{
                        y: -8,
                        duration: 250,
                        delay: 50,
                        easing: cubicOut,
                    }}
                    out:fly={{ y: 8, duration: 150, easing: cubicOut }}
                >
                    {$todayReadCountStore}
                </span>
            {/key}
            <span class="font-normal">{$_("past24h.todayReadSuffix")}</span>
        </div>
    {/if}
</div>

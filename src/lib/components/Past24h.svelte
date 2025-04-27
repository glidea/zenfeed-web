<script lang="ts">
    import { onMount, tick, onDestroy } from "svelte";
    import { marked } from "marked";
    import { fly } from "svelte/transition"; // Import fade transition and scale
    import { cubicOut } from "svelte/easing"; // Import an easing function
    import { _ } from "svelte-i18n"; // Import the translation function
    import { getTargetApiUrl } from "$lib/utils/apiUtils";
    import { env } from "$env/dynamic/public";

    const disableAddSource = env.PUBLIC_DISABLE_ADD_SOURCE === "true";
    const disableSearchTerm = env.PUBLIC_DISABLE_SEARCH_TERM === "true";

    interface FeedLabel {
        [key: string]: string;
    }

    interface FeedVO {
        labels: FeedLabel;
        time: string; // Comes as string, parse for sorting
    }

    interface QueryResponse {
        summary: string;
        feeds: FeedVO[];
        count: number;
    }

    interface GroupedFeeds {
        [source: string]: FeedVO[];
    }

    // Unique key for storing read item data (ID -> timestamp) in localStorage
    const READ_ITEMS_STORAGE_KEY = "zenfeed_read_feeds"; // Renamed key for new structure

    // Unique key for storing the selected group by label preference
    const GROUP_BY_LABEL_STORAGE_KEY = "zenfeed_group_by_label";

    // Default label to group by
    const DEFAULT_GROUP_BY_LABEL =
        env.PUBLIC_DEFAULT_GROUP_BY_LABEL || "source";

    const FEED_TITLE_PREFIX_LABEL = env.PUBLIC_FEED_TITLE_PREFIX_LABEL;

    // Type for storing read item data
    type ReadItemsMap = Map<string, number>; // Map<itemId, timestamp>

    let searchTerm = "";
    let searchResults: QueryResponse | null = null;
    let groupedFeeds: GroupedFeeds = {};
    let isLoading = false;
    let availableGroupByLabels: string[] = [DEFAULT_GROUP_BY_LABEL]; // Start with default
    let selectedGroupByLabel = DEFAULT_GROUP_BY_LABEL; // User's selected grouping label
    let error: string | null = null;
    let readItems: ReadItemsMap = new Map(); // Use Map to store ID and timestamp

    // Tooltip state
    let tooltipVisible = false;
    let tooltipContent = ""; // Will contain title + summary
    let tooltipX = 0;
    let tooltipY = 0;
    let tooltipEl: HTMLDivElement | null = null;
    let hideTimeoutId: ReturnType<typeof setTimeout> | null = null; // Added: Timeout ID for hiding

    // Audio element for the sound effect
    let markAsReadSound: HTMLAudioElement | null = null;

    // Filter out read items from the grouped feeds
    $: filteredGroupedFeeds = filterReadItems(groupedFeeds, readItems);

    // Calculate the count of items marked read today
    $: todayReadCount = calculateTodayReadCount(readItems);

    // Sort the groups alphabetically by group name (source or other label value)
    $: sortedGroupEntries = Object.entries(filteredGroupedFeeds).sort(
        (a, b) => {
            // a[0] and b[0] are the group names (e.g., 'HN', 'Reddit', 'Technology')
            return a[0].localeCompare(b[0]);
        },
    );

    // Reactive variable for parsed summary HTML
    let summaryHtml = "";
    $: summaryHtml = searchResults?.summary
        ? (marked.parse(searchResults.summary) as string)
        : "";

    function simpleHash(str: string): number {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) + hash + char;
        }
        return hash >>> 0;
    }

    // Helper function to create a unique ID for a feed item based on labels hash
    function getFeedItemId(feed: FeedVO): string {
        const labels = feed.labels;
        const sortedKeys = Object.keys(labels).sort();
        const combinedString = sortedKeys
            .map((key) => `${key}=${labels[key]}`)
            .join("&");
        const hashValue = simpleHash(combinedString);
        return hashValue.toString();
    }

    // Comparison function for sorting feeds
    function compareFeeds(a: FeedVO, b: FeedVO): number {
        try {
            // Primary sort: time descending
            const timeA = new Date(a.time);
            const timeB = new Date(b.time);
            if (timeA > timeB) return -1;
            if (timeA < timeB) return 1;

            // Secondary sort: title ascending
            const titleA = a.labels.title || "";
            const titleB = b.labels.title || "";
            return titleA.localeCompare(titleB);
        } catch (e) {
            // Fallback sort if date parsing fails
            console.error("Error parsing date during sort:", e, a.time, b.time);
            const titleA = a.labels.title || "";
            const titleB = b.labels.title || "";
            return titleA.localeCompare(titleB);
        }
    }

    // Check if a timestamp is from today
    function isToday(timestamp: number): boolean {
        const now = new Date();
        const dateFromTimestamp = new Date(timestamp);
        return (
            dateFromTimestamp.getDate() === now.getDate() &&
            dateFromTimestamp.getMonth() === now.getMonth() &&
            dateFromTimestamp.getFullYear() === now.getFullYear()
        );
    }

    // Calculate how many items in the map were marked read today
    function calculateTodayReadCount(items: ReadItemsMap): number {
        let count = 0;
        for (const timestamp of items.values()) {
            if (isToday(timestamp)) {
                count++;
            }
        }
        return count;
    }

    // Filter read items out of the grouped feeds object (check if ID exists in map)
    function filterReadItems(
        groups: GroupedFeeds,
        readItemsMap: ReadItemsMap,
    ): GroupedFeeds {
        const filteredGroups: GroupedFeeds = {};
        for (const source in groups) {
            const unreadFeeds = groups[source].filter(
                (feed) => !readItemsMap.has(getFeedItemId(feed)), // Check key existence
            );
            if (unreadFeeds.length > 0) {
                filteredGroups[source] = unreadFeeds;
            }
        }
        return filteredGroups;
    }

    // Fetch data from the /api/query API
    async function fetchFeeds() {
        isLoading = true;
        error = null;
        searchResults = null; // Reset search results
        groupedFeeds = {}; // Reset grouped feeds

        try {
            const now = new Date();
            const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const response = await fetch(getTargetApiUrl("/query"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    start: past24h.toISOString(),
                    end: now.toISOString(),
                    limit: 500, // Keep limit high for grouping, display is limited per card
                    query: searchTerm, // Include search term if provided
                    summarize: !!searchTerm, // Only request summary if search term exists
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                // Try parsing error as JSON for potentially better messages from rpc errors
                let detail = errorText;
                try {
                    const jsonError = JSON.parse(errorText);
                    detail = jsonError.message || jsonError.error || errorText;
                } catch (_) {
                    /* Ignore parsing error */
                }
                // Use translated string with interpolation
                throw new Error(
                    $_("past24h.errorApi", {
                        values: { status: response.status, detail: detail },
                    }),
                );
            }

            const data: QueryResponse = await response.json();
            searchResults = data; // Store raw results including summary
            updateAvailableLabels(data.feeds); // Determine available labels *before* grouping
            groupFeeds(data.feeds, selectedGroupByLabel); // Group using the current selection
        } catch (e: any) {
            console.error("Failed to fetch feeds:", e);
            // Use the existing error message (already translated if thrown above) or a default translated one
            error = e.message || $_("past24h.errorLoadingDefault");
        } finally {
            isLoading = false;
        }
    }

    // Discover available labels, filter useless ones, and validate saved preference
    function updateAvailableLabels(feeds: FeedVO[]) {
        const allLabels = new Set<string>([DEFAULT_GROUP_BY_LABEL]); // Always include default
        const labelValueCounts: { [key: string]: { [value: string]: number } } =
            {};

        feeds.forEach((feed) => {
            Object.keys(feed.labels).forEach((labelKey) => {
                if (
                    labelKey === "link" ||
                    labelKey === "title" ||
                    labelKey === "summary_html_snippet"
                )
                    return; // Skip core fields

                allLabels.add(labelKey);
                const labelValue =
                    feed.labels[labelKey] || $_("past24h.uncategorizedGroup");

                if (!labelValueCounts[labelKey]) {
                    labelValueCounts[labelKey] = {};
                }
                labelValueCounts[labelKey][labelValue] =
                    (labelValueCounts[labelKey][labelValue] || 0) + 1;
            });
        });

        // Filter out labels where every value corresponds to only one feed
        const usefulLabels = Array.from(allLabels).filter((labelKey) => {
            if (labelKey === DEFAULT_GROUP_BY_LABEL) return true; // Always keep the default
            const counts = labelValueCounts[labelKey];
            if (!counts) return false; // Should not happen, but safeguard
            // Check if *any* value count is greater than 1
            return Object.values(counts).some((count) => count > 1);
        });

        availableGroupByLabels = usefulLabels.sort(); // Sort alphabetically

        // Validate the currently selected group-by label
        if (!availableGroupByLabels.includes(selectedGroupByLabel)) {
            console.warn(
                `Selected group label "${selectedGroupByLabel}" no longer valid or available. Resetting to "${DEFAULT_GROUP_BY_LABEL}".`,
            );
            selectedGroupByLabel = DEFAULT_GROUP_BY_LABEL;
            // No need to explicitly save here, the reactive statement below handles it
        }
    }

    // Group feeds by a specified label key and sort them
    function groupFeeds(feeds: FeedVO[], groupByKey: string) {
        const groups: GroupedFeeds = {};
        feeds.forEach((feed) => {
            // Use the selected groupByKey, fall back to default uncategorized
            const groupValue =
                feed.labels[groupByKey] || $_("past24h.uncategorizedGroup");
            if (!groups[groupValue]) {
                groups[groupValue] = [];
            }
            groups[groupValue].push(feed);
        });

        // Sort feeds within each group (using existing compareFeeds)
        for (const groupValue in groups) {
            groups[groupValue].sort(compareFeeds);
        }

        groupedFeeds = groups;
    }

    // Update grouped feeds whenever the selected label changes
    $: {
        if (searchResults && !isLoading) {
            // Avoid regrouping during initial load or if no results
            groupFeeds(searchResults.feeds, selectedGroupByLabel);
            // Save the selected label to localStorage
            try {
                localStorage.setItem(
                    GROUP_BY_LABEL_STORAGE_KEY,
                    selectedGroupByLabel,
                );
            } catch (e) {
                console.error("Failed to save group by preference:", e);
            }
        }
    }

    // Function to handle search button click
    function handleSearch() {
        // Prevent search if already loading
        if (isLoading) return;
        fetchFeeds(); // Refetch with the current search term
    }

    // Function to handle search input keydown (Enter key)
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            handleSearch();
        }
    }

    // Tooltip event handlers
    async function showTooltip(
        event: MouseEvent, // Keep event for fallback positioning
        anchorElement: HTMLElement | null, // The element to position relative to
        summary: string,
        title: string,
    ) {
        // Clear any pending hide operations when showing/moving to a new tooltip trigger
        if (hideTimeoutId) {
            clearTimeout(hideTimeoutId);
            hideTimeoutId = null;
        }

        // Prepend title to the summary content if title exists
        let finalContent = summary || ""; // Start with summary or empty string
        if (title) {
            // Simple bold title for separation
            finalContent = `<strong class="block mb-1.5 text-lg">${title}</strong>${finalContent}`;
        }

        if (!finalContent || finalContent.trim() === "") {
            hideTooltip(0); // Hide immediately if content is empty
            return;
        }

        tooltipContent = finalContent; // Use the combined content
        tooltipVisible = true;

        // Wait for Svelte to update the DOM so the tooltip exists and has content
        await tick();

        if (tooltipEl && anchorElement) {
            const tooltipRect = tooltipEl.getBoundingClientRect();
            const anchorRect = anchorElement.getBoundingClientRect(); // Get anchor bounds
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            const offset = 10; // Gap between anchor and tooltip

            let finalX = 0;
            let finalY = 0;
            let positionFound = false;

            // Function to calculate and clamp vertical position (try centering)
            const calculateY = (
                anchorRect: DOMRect,
                tooltipRect: DOMRect,
            ): number => {
                let y =
                    anchorRect.top +
                    scrollY +
                    anchorRect.height / 2 -
                    tooltipRect.height / 2;
                // Clamp within viewport
                y = Math.max(scrollY + offset, y); // Ensure at least `offset` from top edge
                y = Math.min(
                    y,
                    viewportHeight + scrollY - tooltipRect.height - offset,
                ); // Ensure at least `offset` from bottom edge
                return y;
            };

            // Function to calculate and clamp horizontal position (try centering)
            const calculateX = (
                anchorRect: DOMRect,
                tooltipRect: DOMRect,
            ): number => {
                let x =
                    anchorRect.left +
                    scrollX +
                    anchorRect.width / 2 -
                    tooltipRect.width / 2;
                // Clamp horizontally
                x = Math.max(scrollX + offset, x);
                x = Math.min(
                    x,
                    viewportWidth + scrollX - tooltipRect.width - offset,
                );
                return x;
            };

            // 1. Try Right
            let tryX = anchorRect.right + scrollX + offset;
            let tryY = calculateY(anchorRect, tooltipRect);
            if (tryX + tooltipRect.width <= viewportWidth + scrollX - offset) {
                // Check right bound with offset
                finalX = tryX;
                finalY = tryY;
                positionFound = true;
            }

            // 2. Try Left
            if (!positionFound) {
                tryX = anchorRect.left + scrollX - tooltipRect.width - offset;
                tryY = calculateY(anchorRect, tooltipRect);
                if (tryX >= scrollX + offset) {
                    // Check left bound with offset
                    finalX = tryX;
                    finalY = tryY;
                    positionFound = true;
                }
            }

            // 3. Try Below
            if (!positionFound) {
                tryX = calculateX(anchorRect, tooltipRect); // Center horizontally
                tryY = anchorRect.bottom + scrollY + offset;
                if (
                    tryY + tooltipRect.height <=
                    viewportHeight + scrollY - offset
                ) {
                    // Check bottom bound
                    finalX = tryX;
                    finalY = tryY;
                    positionFound = true;
                }
            }

            // 4. Try Above
            if (!positionFound) {
                tryX = calculateX(anchorRect, tooltipRect); // Center horizontally
                tryY = anchorRect.top + scrollY - tooltipRect.height - offset;
                if (tryY >= scrollY + offset) {
                    // Check top bound
                    finalX = tryX;
                    finalY = tryY;
                    positionFound = true;
                }
            }

            // Fallback: Use original mouse position logic if no suitable position found
            if (!positionFound) {
                console.warn(
                    "Could not find suitable tooltip position relative to element, using mouse fallback.",
                );
                const mouseOffsetX = 15;
                const mouseOffsetY = 15;
                let tentativeX = event.pageX + mouseOffsetX;
                let tentativeY = event.pageY + mouseOffsetY;
                // Adjust horizontal position based on mouse
                if (
                    tentativeX - scrollX + tooltipRect.width >
                    viewportWidth - offset
                ) {
                    tentativeX = event.pageX - tooltipRect.width - mouseOffsetX;
                    if (tentativeX < scrollX + offset)
                        tentativeX = scrollX + offset;
                }
                // Adjust vertical position based on mouse
                if (
                    tentativeY - scrollY + tooltipRect.height >
                    viewportHeight - offset
                ) {
                    tentativeY =
                        event.pageY - tooltipRect.height - mouseOffsetY;
                    if (tentativeY < scrollY + offset)
                        tentativeY = scrollY + offset;
                }
                finalX = tentativeX;
                finalY = tentativeY;
            }

            tooltipX = finalX;
            tooltipY = finalY;
        } else if (tooltipEl) {
            // Fallback if anchorElement is null but tooltipEl exists (use original mouse logic)
            console.warn("Anchor element not provided, using mouse fallback.");
            const tooltipRect = tooltipEl.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;
            const mouseOffsetX = 15;
            const mouseOffsetY = 15;
            let tentativeX = event.pageX + mouseOffsetX;
            let tentativeY = event.pageY + mouseOffsetY;
            if (
                tentativeX - scrollX + tooltipRect.width >
                viewportWidth - mouseOffsetX
            ) {
                tentativeX = event.pageX - tooltipRect.width - mouseOffsetX;
                if (tentativeX < scrollX + mouseOffsetX)
                    tentativeX = scrollX + mouseOffsetX;
            }
            if (
                tentativeY - scrollY + tooltipRect.height >
                viewportHeight - mouseOffsetY
            ) {
                tentativeY = event.pageY - tooltipRect.height - mouseOffsetY;
                if (tentativeY < scrollY + mouseOffsetY)
                    tentativeY = scrollY + mouseOffsetY;
            }
            tooltipX = tentativeX;
            tooltipY = tentativeY;
        } else {
            // Absolute fallback if tooltipEl isn't ready yet
            tooltipX = event.pageX + 25;
            tooltipY = event.pageY + 25;
        }
    }

    // Function to handle wheel event on tooltip to prevent background scroll
    function handleTooltipWheel(event: WheelEvent) {
        if (!tooltipEl) return;

        const { scrollTop, scrollHeight, clientHeight } = tooltipEl;
        const deltaY = event.deltaY;

        // Check if the tooltip content is actually taller than its visible area
        const isScrollable = scrollHeight > clientHeight;

        if (!isScrollable) {
            // If not scrollable, always prevent background scroll
            event.preventDefault();
            return;
        }

        // Check if scrolling down is possible and attempted
        const isScrollingDown = deltaY > 0;
        const canScrollDown = scrollTop < scrollHeight - clientHeight;

        // Check if scrolling up is possible and attempted
        const isScrollingUp = deltaY < 0;
        const canScrollUp = scrollTop > 0;

        // Prevent background scroll ONLY if the tooltip itself cannot scroll further in the desired direction
        if (isScrollingDown && !canScrollDown) {
            event.preventDefault(); // Prevent scrolling down further (at the bottom)
        } else if (isScrollingUp && !canScrollUp) {
            event.preventDefault(); // Prevent scrolling up further (at the top)
        }
        // Otherwise, allow the default wheel event (scrolling the tooltip content)
    }

    // Hide tooltip after a delay
    function hideTooltip(delay = 200) {
        // Added delay parameter
        if (hideTimeoutId) {
            clearTimeout(hideTimeoutId); // Clear existing timer if any
        }
        hideTimeoutId = setTimeout(() => {
            tooltipVisible = false;
            // No need to clear tooltipEl immediately, might be needed by wheel handler briefly
            // tooltipEl = null; // Clear reference on hide
            hideTimeoutId = null;
        }, delay);
    }

    // Function to cancel the hide timeout (used when mouse enters tooltip)
    function cancelHideTooltip() {
        if (hideTimeoutId) {
            clearTimeout(hideTimeoutId);
            hideTimeoutId = null;
        }
    }

    // Custom transition for shrinking and fading out
    function shrinkFadeOut(
        node: HTMLElement,
        { delay = 0, duration = 500, easing = cubicOut },
    ) {
        const style = getComputedStyle(node);
        const originalOpacity = +style.opacity;
        const originalHeight = node.offsetHeight; // Use offsetHeight for rendered height
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
                transform-origin: top; /* Shrink upwards */
                height: ${u * originalHeight}px;
                margin-top: ${u * originalMarginTop}px;
                margin-bottom: ${u * originalMarginBottom}px;
                padding-top: ${u * originalPaddingTop}px;
                padding-bottom: ${u * originalPaddingBottom}px;
                overflow: hidden; /* Prevent content spill */
                /* Add a subtle box-shadow fade-out for extra effect */
                box-shadow: 0px ${u * 4}px ${u * 6}px -${u * 1}px rgba(0, 0, 0, ${u * 0.1}), 0px ${u * 2}px ${u * 4}px -${u * 2}px rgba(0, 0, 0, ${u * 0.1});
            `,
        };
    }

    // Function to handle marking an item as read via context menu
    function handleMarkAsRead(event: MouseEvent, feed: FeedVO) {
        event.preventDefault();
        const itemId = getFeedItemId(feed);
        const nowTimestamp = Date.now();

        if (!readItems.has(itemId)) {
            // Play sound effect
            if (markAsReadSound) {
                markAsReadSound.currentTime = 0;
                markAsReadSound.play().catch((error) => {
                    console.warn("Audio playback failed:", error);
                });
            }

            // Update the reactive map to trigger UI changes
            readItems.set(itemId, nowTimestamp);
            readItems = new Map(readItems); // Trigger reactivity by creating a new map instance

            // Update localStorage for persistence
            try {
                // Convert map to array of [key, value] pairs for JSON serialization
                const storableArray = Array.from(readItems.entries());
                localStorage.setItem(
                    READ_ITEMS_STORAGE_KEY,
                    JSON.stringify(storableArray),
                );
            } catch (e) {
                console.error("Failed to save read items to localStorage:", e);
            }
        }
        hideTooltip(0);
    }

    // Fetch initial data, load read items, and prepare audio on component mount
    onMount(() => {
        // Load group by preference first
        try {
            const savedGroupLabel = localStorage.getItem(
                GROUP_BY_LABEL_STORAGE_KEY,
            );
            // No need to validate here, validation happens *after* fetch when available labels are known
            if (savedGroupLabel) {
                selectedGroupByLabel = savedGroupLabel;
            }
        } catch (e) {
            console.error("Failed to load group by preference:", e);
        }

        // Preload the audio file
        markAsReadSound = new Audio("/sounds/woodfish.mp3");
        markAsReadSound.volume = 0.5;
        markAsReadSound.load();

        // Load read items from localStorage
        try {
            const storedData = localStorage.getItem(READ_ITEMS_STORAGE_KEY);
            if (storedData) {
                const parsedArray = JSON.parse(storedData);
                // Ensure it's an array of pairs before creating the map
                if (
                    Array.isArray(parsedArray) &&
                    parsedArray.every(
                        (pair) => Array.isArray(pair) && pair.length === 2,
                    )
                ) {
                    readItems = new Map(parsedArray);
                } else {
                    console.warn(
                        "Invalid data format found in localStorage for read items. Clearing.",
                    );
                    localStorage.removeItem(READ_ITEMS_STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error(
                "Failed to load or parse read items from localStorage:",
                e,
            );
            // Clear potentially corrupted data
            localStorage.removeItem(READ_ITEMS_STORAGE_KEY);
        }

        fetchFeeds(); // Fetch initial data
    });

    // Clean up the event listener when the component is destroyed
    onDestroy(() => {
        if (hideTimeoutId) {
            clearTimeout(hideTimeoutId);
        }
    });
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
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                    />
                </svg>
                {$_("past24h.addSourceButton")}
            </a>
        </div>
    {/if}

    <!-- Search Section -->
    <div class="flex flex-wrap items-center gap-3">
        <!-- Group By Dropdown (Moved to the left) -->
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
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="m19.5 8.25-7.5 7.5-7.5-7.5"
                            />
                        </svg>
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
                                        selectedGroupByLabel =
                                            labelKey; /* Dropdown closes on focus loss */
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
                    class="input input-bordered input-primary focus:ring-primary focus:border-primary w-full max-w-lg rounded-lg bg-white/90 px-4 py-2.5 text-base focus:ring-2 focus:outline-none"
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
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                        />
                    </svg>
                    <span class="ml-1.5 hidden sm:inline"
                        >{$_("past24h.searchButton")}</span
                    >
                </button>
                <!-- Back Button -->
                {#if !isLoading && ((searchResults && searchResults.summary) || Object.keys(groupedFeeds).length === 0)}
                    <button
                        class="btn btn-ghost rounded-lg"
                        on:click={() => {
                            searchTerm = "";
                            handleSearch(); // Fetch feeds without search term (effectively 'go back')
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
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                            />
                        </svg>
                        <span class="ml-1.5 hidden sm:inline"
                            >{$_("past24h.backButton")}</span
                        >
                    </button>
                {/if}
            </div>
        {/if}
        <!-- End of centered search wrapper -->
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

    <!-- Feed Cards Section - Vertical Grid -->
    <div class="min-h-[350px] rounded-lg">
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
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <span class="text-error-content ml-2 font-semibold"
                        >{$_("past24h.errorPrefix")}</span
                    >
                    <span class="text-error-content ml-1">{error}</span>
                </div>
            </div>
        {:else if Object.keys(filteredGroupedFeeds).length > 0}
            <div
                class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
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
                                class="scrollbar-thin scrollbar-thumb-secondary/30 scrollbar-track-transparent list-none space-y-2.5 overflow-y-auto pr-1 text-sm"
                                style="max-height: 240px;"
                            >
                                {#each feeds as feed (getFeedItemId(feed))}
                                    <li
                                        class="truncate"
                                        on:contextmenu={(e) =>
                                            handleMarkAsRead(e, feed)}
                                        out:shrinkFadeOut={{ duration: 500 }}
                                        title={$_("past24h.markAsReadHint")}
                                    >
                                        <a
                                            href={feed.labels.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="text-primary hover:text-secondary break-words hover:underline"
                                            on:mouseenter={(e) => {
                                                // Get the parent list item (li) as the anchor
                                                const targetElement =
                                                    e.currentTarget as HTMLElement;
                                                const anchorEl =
                                                    targetElement.closest("li");
                                                // When mouse enters the link, show tooltip and cancel any pending hide
                                                cancelHideTooltip();
                                                showTooltip(
                                                    e,
                                                    anchorEl, // Pass the li element as anchor
                                                    feed.labels
                                                        .summary_html_snippet,
                                                    feed.labels.title ||
                                                        $_(
                                                            "past24h.untitledFeed",
                                                        ), // Use translated default title
                                                );
                                            }}
                                            on:mouseleave={() => hideTooltip()}
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
        {:else if Object.keys(groupedFeeds).length === 0}
            <!-- Empty State - More Contrast -->
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
                    {:else}
                        {$_("past24h.emptyStateNoFeeds")}
                    {/if}
                </p>
                <p class="text-neutral/80 mb-6 text-sm">
                    {#if searchTerm}
                        {$_("past24h.emptyStateSearchHint")}
                    {:else}
                        {$_("past24h.emptyStateNoFeedsHint")}
                    {/if}
                </p>
            </div>
        {/if}
    </div>

    <!-- Tooltip Element -->
    {#if tooltipVisible}
        <div
            bind:this={tooltipEl}
            class="tooltip-container border-base-300 bg-base-100/95 fixed z-50 max-w-2xl rounded-3xl border p-8 text-xs shadow-xl backdrop-blur-md transition-all duration-600 ease-out"
            style="left: {tooltipX}px; top: {tooltipY}px; font-size: 0.7rem; line-height: 0.95rem; overflow-y: auto; max-height: 100vh;"
            on:mouseenter={cancelHideTooltip}
            on:mouseleave={() => hideTooltip()}
            on:wheel={handleTooltipWheel}
            on:click={() => hideTooltip(0)}
            transition:fly={{ y: 10, duration: 200 }}
        >
            <!-- Hint for closing -->
            <span
                class="absolute top-2 right-3 text-neutral-content/70 text-[0.8rem]"
            >
                {$_("past24h.tooltipCloseHint")}
            </span>
            <!-- Existing tooltip content -->
            {@html tooltipContent}
        </div>
    {/if}

    <!-- MCP Client Hint -->
    {#if !isLoading && searchTerm && searchResults && searchResults.summary}
        <div class="mt-8 text-center pb-8">
            <!-- Added pb-16 to prevent overlap with bottom counter -->
            <p class="text-neutral-content/100 text-sm">
                {@html $_("past24h.mcpHint", {
                    values: {
                        cherryStudioLink: `<a href="https://github.com/glidea/zenfeed/blob/main/docs/cherry-studio-mcp.md" target="_blank" rel="noopener noreferrer" class="link link-secondary">Cherry Studio</a>`,
                    },
                })}
            </p>
        </div>
    {/if}

    <!-- Bottom Center Read Count (Today Only & Blue) -->
    {#if todayReadCount > 0}
        <div
            class="fixed bottom-5 left-1/2 transform -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white shadow-lg backdrop-blur-sm flex items-center space-x-2 text-sm font-bold transition-all duration-300 ease-out select-none"
            in:fly={{ y: 20, duration: 400, easing: cubicOut }}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="w-5 h-5 opacity-90"
            >
                <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                    clip-rule="evenodd"
                />
            </svg>

            <span class="font-normal">{$_("past24h.todayReadPrefix")}</span>
            {#key todayReadCount}
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
                    {todayReadCount}
                </span>
            {/key}
            <span class="font-normal">{$_("past24h.todayReadSuffix")}</span>
        </div>
    {/if}
</div>

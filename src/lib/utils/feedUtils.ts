import { simpleHash } from "./hashUtils";
import type { FeedVO } from "$lib/types/feed"; // Import the type

/**
 * Generates a unique ID for a feed item based on its labels.
 * Uses a pre-calculated ID if available.
 * @param feed Feed object
 * @returns Unique string ID for the feed
 */
export function getFeedItemId(feed: FeedVO): string {
    // Use pre-calculated ID if available
    if (feed.id) return feed.id;

    // Calculate otherwise
    const labels = feed.labels;
    // Sort keys for consistent hash input
    const sortedKeys = Object.keys(labels).sort();
    const combinedString = sortedKeys
        .map((key) => `${key}=${labels[key]}`)
        .join("&");
    const hashValue = simpleHash(combinedString);
    return hashValue.toString();
}

/**
 * Compares two feed items for sorting.
 * Sorts primarily by time (descending), then by title (ascending).
 * Handles potential date parsing errors gracefully.
 * @param a First FeedVO object
 * @param b Second FeedVO object
 * @returns -1 if a < b, 1 if a > b, 0 if equal (for sorting)
 */
export function compareFeeds(a: FeedVO, b: FeedVO): number {
    try {
        // Compare time first (most recent first)
        const timeA = new Date(a.time);
        const timeB = new Date(b.time);
        if (timeA > timeB) return -1;
        if (timeA < timeB) return 1;

        // If times are equal, compare by title (alphabetical)
        const titleA = a.labels.title || "";
        const titleB = b.labels.title || "";
        return titleA.localeCompare(titleB);
    } catch (e) {
        // Fallback to title sort if date parsing fails
        console.error("Error parsing date during sort:", e, a.time, b.time);
        const titleA = a.labels.title || "";
        const titleB = b.labels.title || "";
        return titleA.localeCompare(titleB);
    }
} 
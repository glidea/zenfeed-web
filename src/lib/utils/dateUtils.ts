// Define the type for read items map
export type ReadItemsMap = Map<string, number>; // Map<itemId, timestamp>

/**
 * Checks if a given timestamp represents a date that is today.
 * @param timestamp Unix timestamp in milliseconds
 * @returns True if the timestamp is today, false otherwise
 */
export function isToday(timestamp: number): boolean {
    const now = new Date();
    const dateFromTimestamp = new Date(timestamp);
    return (
        dateFromTimestamp.getDate() === now.getDate() &&
        dateFromTimestamp.getMonth() === now.getMonth() &&
        dateFromTimestamp.getFullYear() === now.getFullYear()
    );
}

/**
 * Calculates the number of items in the map that were marked read today.
 * @param items Map of read item IDs to timestamps
 * @returns Count of items marked read today
 */
export function calculateTodayReadCount(items: ReadItemsMap): number {
    let count = 0;
    for (const timestamp of items.values()) {
        if (isToday(timestamp)) {
            count++;
        }
    }
    return count;
} 
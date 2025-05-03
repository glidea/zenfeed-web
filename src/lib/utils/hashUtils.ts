/**
 * Simple DJB2 hash function.
 * @param str Input string
 * @returns Unsigned 32-bit hash value
 */
export function simpleHash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) + hash + char; // hash * 33 + char
    }
    return hash >>> 0; // Ensure non-negative integer
} 
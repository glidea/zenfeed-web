/**
 * Prevents the scroll event from bubbling up (chaining) when the
 * element is already at its scroll boundaries (top or bottom).
 * Useful for nested scrollable elements.
 * @param event The WheelEvent
 */
export function preventScrollChaining(event: WheelEvent) {
    const element = event.currentTarget as HTMLElement;
    const { scrollTop, scrollHeight, clientHeight } = element;
    const deltaY = event.deltaY; // Get deltaY from the event

    // Only prevent if the element is actually scrollable
    if (scrollHeight <= clientHeight) {
        return;
    }

    // Prevent scrolling up when already at the top
    if (scrollTop === 0 && deltaY < 0) {
        event.preventDefault();
    }

    // Prevent scrolling down when already at the bottom
    // Use a small tolerance (e.g., 1px) for potential floating point inaccuracies
    if (scrollTop + clientHeight >= scrollHeight - 1 && deltaY > 0) {
        event.preventDefault();
    }
} 
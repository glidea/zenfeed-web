// Define shared types here
export interface FeedLabel {
    [key: string]: string;
}

export interface FeedVO {
    labels: FeedLabel;
    time: string;
    id?: string; // Optional pre-calculated ID
    // Add other potential fields if necessary
} 
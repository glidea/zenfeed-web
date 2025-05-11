// Define shared types here
export interface FeedLabels {
    [key: string]: string;
}

export interface FeedVO {
    labels: FeedLabels;
    time: string;
    id?: string; // Optional pre-calculated ID
    // Add other potential fields if necessary
} 
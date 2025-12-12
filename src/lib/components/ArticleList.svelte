<script lang="ts">
  import { queryFeedsStore, selectedFeedStore } from '$lib/stores/feedStore';
  import { isReadStore } from '$lib/stores/readStateStore';
  import dayjs from 'dayjs';
  import relativeTime from 'dayjs/plugin/relativeTime';
  
  dayjs.extend(relativeTime);
  
  // Subscribe to stores
  // In Svelte 5 runes mode this might differ, but assuming Svelte 4/standard usage for now based on package.json (svelte ^5.0.0 could mean runes, but let's stick to standard syntax unless error)
  // Actually package.json says "svelte": "^5.0.0". Standard Svelte 4 syntax is valid in 5.
  
  // Handlers
  function selectFeed(feed: any) {
    selectedFeedStore.set(feed);
  }
</script>

<div class="h-full flex flex-col bg-background-primary border-r border-border-subtle w-full max-w-md min-w-[320px]">
  <!-- Toolbar -->
  <div class="h-14 px-4 border-b border-border-subtle flex items-center justify-between sticky top-0 bg-background-primary/80 backdrop-blur-md z-10">
    <h2 class="font-semibold text-text-primary">Articles</h2>
    <div class="flex space-x-2">
       <button class="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-background-tertiary transition-colors">
         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"></path></svg>
       </button>
       <button class="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-background-tertiary transition-colors">
         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg>
       </button>
    </div>
  </div>

  <!-- List -->
  <div class="flex-1 overflow-y-auto p-2 space-y-2 scroller">
    {#if $queryFeedsStore && $queryFeedsStore.feeds}
      {#each $queryFeedsStore.feeds as feed (feed.id || Math.random())}
          <button 
            class="w-full text-left p-4 rounded-lg border border-transparent transition-all duration-200 group
             {$selectedFeedStore?.id === feed.id 
                ? 'bg-background-tertiary border-border-highlight shadow-card' 
                : 'hover:bg-background-secondary hover:border-border-subtle'}"
            on:click={() => selectFeed(feed)}
          >
            <!-- Meta row -->
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center space-x-2">
                 <!-- Icon placeholder or favicon -->
                 <div class="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center">
                    <span class="text-[10px] text-accent font-bold">Z</span>
                 </div>
                 <span class="text-xs font-medium text-text-secondary truncate max-w-[120px]">
                    {feed.labels?.source || 'Unknown Source'}
                 </span>
              </div>
              <span class="text-[10px] text-text-muted">
                 {dayjs(feed.time).fromNow(true)}
              </span>
            </div>

            <!-- Title -->
            <h3 class="text-sm font-semibold text-text-primary leading-snug mb-2 line-clamp-2 group-hover:text-white transition-colors
               {$isReadStore(feed.id) ? 'text-text-muted font-normal' : ''}">
               {feed.labels?.title || 'No Title'}
            </h3>

            <!-- Snippet -->
            <p class="text-xs text-text-muted line-clamp-2 leading-relaxed">
               {@html (feed.labels?.summary || 'No content preview available...').replace(/<[^>]*>?/gm, '')}
            </p>
          </button>
      {/each}
    {:else}
      <div class="flex flex-col items-center justify-center h-full text-text-muted">
         <p>No articles found</p>
      </div>
    {/if}
  </div>
</div>

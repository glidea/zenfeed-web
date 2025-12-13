<script lang="ts">
  import { queryFeedsStore, selectedFeedStore } from '$lib/stores/feedStore';
  import { isReadStore } from '$lib/stores/readStateStore';
  import { pinnedArticlesStore, starredArticlesStore } from '$lib/stores/articleActionsStore';
  import { getFeedItemId, groupFeedsByLabel } from '$lib/utils/feedUtils';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import dayjs from 'dayjs';
  import relativeTime from 'dayjs/plugin/relativeTime';
  
  dayjs.extend(relativeTime);

  export let selectedGroup: string | null = null;
  export let onPinArticle: (articleId: string) => void = () => {};
  
  // Search state
  let searchTerm = '';
  let searchInputRef: HTMLInputElement;
  let showSearch = false;
  
  // Filter state - for starred view
  let showOnlyStarred = false;
  
  // Get filtered and sorted feeds
  $: sortedFeeds = (() => {
    if (!$queryFeedsStore?.feeds) return [];
    
    let feeds = $queryFeedsStore.feeds;
    
    // Filter by group first
    if (selectedGroup) {
      const grouped = groupFeedsByLabel(feeds, 'source');
      feeds = grouped[selectedGroup] || [];
    }
    
    // Filter by starred if needed
    if (showOnlyStarred) {
      feeds = feeds.filter(feed => $starredArticlesStore.has(getFeedItemId(feed)));
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      feeds = feeds.filter(feed => {
        const title = (feed.labels?.title || '').toLowerCase();
        const summary = (feed.labels?.summary || '').toLowerCase();
        const source = (feed.labels?.source || '').toLowerCase();
        return title.includes(term) || summary.includes(term) || source.includes(term);
      });
    }
    
    // Sort: pinned first, then by time
    return feeds.sort((a, b) => {
      const aId = getFeedItemId(a);
      const bId = getFeedItemId(b);
      const aPinned = $pinnedArticlesStore.has(aId);
      const bPinned = $pinnedArticlesStore.has(bId);
      
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      
      // Both pinned or both not pinned, sort by time
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });
  })();
  
  // Handlers
  function selectFeed(feed: any) {
    const feedData = {
      id: getFeedItemId(feed),
      title: feed.labels?.title || 'No Title',
      tags: feed.labels?.tags || '',
      summaryHtmlSnippet: feed.labels?.summary_html_snippet || '',
      link: feed.labels?.link || ''
    };
    selectedFeedStore.set(feedData);
  }
  
  function handlePinClick(feed: any, e: MouseEvent) {
    e.stopPropagation();
    const articleId = getFeedItemId(feed);
    pinnedArticlesStore.toggle(articleId);
  }
  
  function toggleSearch() {
    showSearch = !showSearch;
    if (showSearch) {
      setTimeout(() => searchInputRef?.focus(), 100);
    } else {
      searchTerm = '';
    }
  }
  
  function clearSearch() {
    searchTerm = '';
    searchInputRef?.focus();
  }
  
  // Keyboard shortcut for search (Cmd/Ctrl + K)
  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      showSearch = true;
      setTimeout(() => searchInputRef?.focus(), 100);
    }
  }
  
  // Export function to toggle starred filter
  export function toggleStarredFilter(value: boolean) {
    showOnlyStarred = value;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="h-full flex flex-col bg-background-primary border-r border-ghost w-full max-w-md min-w-[320px] relative with-noise">
  <!-- Top decorative gradient divider -->
  <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent-emerald/30 to-transparent"></div>

  <!-- Toolbar - Glassmorphic -->
  <div class="h-14 px-4 border-b border-ghost flex items-center justify-between sticky top-0 bg-background-primary/70 backdrop-blur-md z-10">
    <h2 class="font-semibold text-text-primary tracking-tight text-xs uppercase opacity-85 letter-spacing-wider">
      {selectedGroup ? `📚 ${selectedGroup}` : '📖 All Articles'}
    </h2>
    <div class="flex space-x-1">
       <!-- Search button -->
       <button 
         class="p-1.5 text-text-muted hover:text-accent-mint transition-linear rounded-md
                 {showSearch ? 'bg-accent-emerald/15 text-accent-mint shadow-glow-sm' : 'hover:bg-accent-emerald/10'} border border-ghost hover:border-accent-emerald/30"
         onclick={toggleSearch}
         title="Search (⌘K)"
         aria-label="Search articles"
       >
         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
       </button>
    </div>
  </div>

  <!-- Search Bar - Glassmorphic -->
  {#if showSearch}
    <div class="px-3 py-3 border-b border-ghost bg-gradient-emerald-dark animate-slide-in-down">
      <div class="relative group">
        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-mint transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <input
          bind:this={searchInputRef}
          bind:value={searchTerm}
          type="text"
          placeholder="Search titles, summaries, sources..."
          class="w-full bg-background-secondary/60 border border-ghost focus:border-accent-mint/50 rounded-lg pl-10 pr-10 py-2 text-sm 
                 text-text-primary placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-mint/20 transition-linear"
        />
        {#if searchTerm}
          <button
            onclick={clearSearch}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-accent-mint transition-linear"
            title="Clear search"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        {/if}
      </div>
      {#if searchTerm && sortedFeeds.length > 0}
        <div class="mt-2 text-xs text-text-secondary/70 font-medium">
          ✓ Found {sortedFeeds.length} result{sortedFeeds.length === 1 ? '' : 's'}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Articles List -->
  <div class="flex-1 overflow-y-auto p-3 space-y-2.5 scroller">
    {#if sortedFeeds.length > 0}
      {#each sortedFeeds as feed (getFeedItemId(feed))}
          <div 
            class="w-full text-left p-4 rounded-lg transition-linear group relative overflow-hidden cursor-pointer
                   indicator-bar {$selectedFeedStore?.id === getFeedItemId(feed) ? 'active' : ''}
                   card-elevated {$selectedFeedStore?.id === getFeedItemId(feed)
                ? 'border-accent-mint/40 shadow-glow-md bg-gradient-emerald' 
                : 'border-ghost hover:border-accent-emerald/30 hover:shadow-glow-sm hover:bg-background-secondary/60'}"
            onclick={() => selectFeed(feed)}
            animate:flip={{ duration: 400 }}
            transition:fly={{ y: -20, duration: 300 }}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && selectFeed(feed)}
          >
            <!-- Pinned Indicator - Top right pulse (green dot) -->
            {#if $pinnedArticlesStore.has(getFeedItemId(feed))}
              <div class="absolute top-3 right-3 flex items-center gap-1.5">
                <div class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
              </div>
            {/if}

            <!-- Meta row - Source + Time -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-2 flex-1 min-w-0">
                 <!-- Source badge -->
                 <span class="text-[10px] font-bold tracking-widest uppercase text-accent-mint/80 group-hover:text-accent-mint 
                             transition-colors truncate max-w-[140px] flex-shrink-0">
                    {(feed.labels?.source || 'Source').substring(0, 15)}
                 </span>
              </div>
              <div class="flex items-center space-x-1.5 flex-shrink-0">
                 <!-- Pin button (up arrow) -->
                 <button
                   onclick={(e) => handlePinClick(feed, e)}
                   class="p-1 transition-linear {$pinnedArticlesStore.has(getFeedItemId(feed)) 
                          ? 'text-accent-mint bg-accent-emerald/15 shadow-glow-sm' 
                          : 'text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent-mint hover:bg-accent-emerald/10'} 
                        rounded-md border border-ghost hover:border-accent-emerald/40 z-10"
                   title={$pinnedArticlesStore.has(getFeedItemId(feed)) ? 'Unpin' : 'Pin to top'}
                   aria-label={$pinnedArticlesStore.has(getFeedItemId(feed)) ? 'Unpin article' : 'Pin article to top'}
                 >
                   <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7 7 7M12 3v18"/>
                   </svg>
                 </button>
                 <!-- Time badge -->
                 <span class="text-xs text-text-muted font-mono px-2 py-1 rounded-md bg-background-secondary/60 border border-ghost whitespace-nowrap">
                    {dayjs(feed.time).fromNow(true)}
                 </span>
              </div>
            </div>

            <!-- Title -->
            <h3 class="text-sm font-semibold text-text-primary leading-snug mb-2 line-clamp-2 transition-colors
               {$selectedFeedStore?.id === getFeedItemId(feed) ? 'text-gradient-emerald' : 'group-hover:text-accent-mint'} 
               {$isReadStore(getFeedItemId(feed)) && $selectedFeedStore?.id !== getFeedItemId(feed) ? 'text-text-muted/70 font-normal' : ''}">
               {feed.labels?.title || 'No Title'}
            </h3>

            <!-- Summary -->
            <p class="text-xs text-white/90 line-clamp-2 leading-relaxed transition-opacity">
               {@html (feed.labels?.summary || 'No preview available').substring(0, 150).replace(/<[^>]*>?/gm, '') + '...'}
            </p>
          </div>
      {/each}
    {:else}
      <!-- Empty State -->
      <div class="flex flex-col items-center justify-center h-full text-text-muted/60">
         <div class="w-16 h-16 rounded-lg bg-gradient-emerald-dark flex items-center justify-center mb-4 border border-ghost">
            <svg class="w-8 h-8 text-text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
         </div>
         <p class="font-medium">No articles found</p>
         <p class="text-xs opacity-60 mt-1">Try adjusting your filters</p>
      </div>
    {/if}
  </div>
</div>

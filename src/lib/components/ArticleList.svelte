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

<div class="h-full flex flex-col bg-background-primary/50 backdrop-blur-md border-r border-border-subtle w-full max-w-md min-w-[320px] relative">
  <!-- Top decorative line - green -->
  <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent-emerald/20 to-transparent"></div>

  <!-- Toolbar -->
  <div class="h-14 px-4 border-b border-border-subtle/50 flex items-center justify-between sticky top-0 bg-background-primary/80 backdrop-blur-xl z-10 shadow-sm">
    <h2 class="font-bold text-text-primary tracking-tight text-sm uppercase opacity-90">
      {selectedGroup || 'All Articles'}
    </h2>
    <div class="flex space-x-1">
       <!-- Search button -->
       <button 
         class="p-1.5 text-text-muted hover:text-accent-emerald hover:bg-accent-emerald/10 rounded-md transition-all duration-300 {showSearch ? 'bg-accent-emerald/10 text-accent-emerald' : ''}"
         onclick={toggleSearch}
         title="Search (⌘K)"
         aria-label="Search articles"
       >
         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
       </button>
    </div>
  </div>

  <!-- Search Bar -->
  {#if showSearch}
    <div class="px-3 py-3 border-b border-border-subtle/30 bg-background-secondary/30 animate-fade-in">
      <div class="relative group">
        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-emerald transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <input
          bind:this={searchInputRef}
          bind:value={searchTerm}
          type="text"
          placeholder="Search articles..."
          class="w-full bg-background-tertiary/50 border border-border-subtle focus:border-accent-emerald/50 rounded-lg pl-10 pr-10 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-emerald/20 transition-all"
        />
        {#if searchTerm}
          <button
            onclick={clearSearch}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-accent-mint transition-colors"
            title="Clear search"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        {/if}
      </div>
      {#if searchTerm && sortedFeeds.length > 0}
        <div class="mt-2 text-xs text-text-secondary">
          Found {sortedFeeds.length} article{sortedFeeds.length === 1 ? '' : 's'}
        </div>
      {/if}
    </div>
  {/if}

  <!-- List -->
  <div class="flex-1 overflow-y-auto p-3 space-y-3 scroller">
    {#if sortedFeeds.length > 0}
      {#each sortedFeeds as feed (getFeedItemId(feed))}
          <div 
            class="w-full text-left p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden cursor-pointer
             {$selectedFeedStore?.id === getFeedItemId(feed)
                ? 'bg-gradient-to-br from-background-secondary to-background-tertiary border-accent-emerald/40 shadow-[0_0_20px_-10px_rgba(16,163,127,0.4)]' 
                : 'bg-background-secondary/30 border-transparent hover:border-accent-mint/20 hover:bg-background-secondary/80 hover:shadow-lg hover:-translate-y-0.5'}"
            onclick={() => selectFeed(feed)}
            animate:flip={{ duration: 400 }}
            transition:fly={{ y: -20, duration: 300 }}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && selectFeed(feed)}
          >
            <!-- Pinned indicator -->
            {#if $pinnedArticlesStore.has(getFeedItemId(feed))}
              <div class="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-accent-emerald shadow-[0_0_8px_var(--accent-emerald)] animate-pulse"></div>
            {/if}
            
            <!-- Active glow indicator - green -->
             {#if $selectedFeedStore?.id === getFeedItemId(feed)}
                <div class="absolute left-0 top-0 bottom-0 w-[3px] bg-accent-emerald shadow-[0_0_8px_var(--accent-emerald)]"></div>
             {/if}

            <!-- Meta row -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-2">
                 <!-- Source indicator -->
                 <div class="w-2 h-2 rounded-full {$selectedFeedStore?.id === getFeedItemId(feed) ? 'bg-accent-emerald shadow-[0_0_5px_var(--accent-emerald)]' : 'bg-text-muted/30 group-hover:bg-accent-mint'} transition-colors"></div>
                 <span class="text-[11px] font-bold tracking-wide uppercase text-text-secondary group-hover:text-text-primary transition-colors truncate max-w-[120px]">
                    {feed.labels?.source || 'Source'}
                 </span>
              </div>
              <div class="flex items-center space-x-1.5">
                 <!-- Pin button on hover - shows on hover OR when pinned -->
                 <button
                   onclick={(e) => handlePinClick(feed, e)}
                   class="{$pinnedArticlesStore.has(getFeedItemId(feed)) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} p-1 hover:bg-accent-emerald/10 rounded transition-opacity z-10"
                   title={$pinnedArticlesStore.has(getFeedItemId(feed)) ? 'Unpin' : 'Pin to top'}
                   aria-label={$pinnedArticlesStore.has(getFeedItemId(feed)) ? 'Unpin article' : 'Pin article to top'}
                 >
                   <svg class="w-3.5 h-3.5 {$pinnedArticlesStore.has(getFeedItemId(feed)) ? 'text-accent-emerald' : 'text-text-muted'}" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                   </svg>
                 </button>
                 <span class="text-[10px] text-text-muted font-mono bg-black/20 px-1.5 py-0.5 rounded">
                    {dayjs(feed.time).fromNow(true)}
                 </span>
              </div>
            </div>

            <!-- Title -->
            <h3 class="text-[15px] font-semibold text-text-primary leading-snug mb-2 line-clamp-2 transition-colors
               { $selectedFeedStore?.id === getFeedItemId(feed) ? 'text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-200' : 'group-hover:text-accent-emerald' }
               {$isReadStore(getFeedItemId(feed)) && $selectedFeedStore?.id !== getFeedItemId(feed) ? 'text-text-muted font-normal' : ''}">
               {feed.labels?.title || 'No Title'}
            </h3>

            <!-- Snippet -->
            <p class="text-xs text-text-secondary/70 line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
               {@html (feed.labels?.summary || 'No preview available...').replace(/<[^>]*>?/gm, '')}
            </p>
          </div>
      {/each}
    {:else}
      <div class="flex flex-col items-center justify-center h-full text-text-muted opacity-50">
         <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <svg class="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
         </div>
         <p>No articles found</p>
      </div>
    {/if}
  </div>
</div>

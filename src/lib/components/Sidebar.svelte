<script lang="ts">
  import { onMount } from 'svelte';
  import { queryFeedsStore } from '$lib/stores/feedStore';
  import { readItemsStore } from '$lib/stores/readStateStore';
  import { starredArticlesStore } from '$lib/stores/articleActionsStore';
  import { groupFeedsByLabel } from '$lib/utils/feedUtils';
  
  export let activeItem = 'inbox';
  export let selectedGroup: string | null = null;
  export let onGroupSelect: (groupName: string) => void = () => {};
  export let onStarredFilterToggle: (enabled: boolean) => void = () => {};

  // Placeholder data for sidebar navigation
  const navItems = [
    { id: 'inbox', label: 'Inbox', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
    { id: 'starred', label: 'Starred', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  ];
  
  // Get groups from store
  $: groups = $queryFeedsStore?.feeds 
    ? Object.keys(groupFeedsByLabel($queryFeedsStore.feeds, 'source')).sort()
    : [];
  
  // Calculate today's read count
  $: todayReadCount = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    let count = 0;
    $readItemsStore.forEach((timestamp) => {
      if (timestamp >= todayTimestamp) {
        count++;
      }
    });
    return count;
  })();
  
  // Handle navigation item click
  function handleNavClick(itemId: string) {
    activeItem = itemId;
    selectedGroup = null;
    
    // Toggle starred filter
    if (itemId === 'starred') {
      onStarredFilterToggle(true);
    } else {
      onStarredFilterToggle(false);
    }
  }
  
  // Handle group click - should reset starred filter
  function handleGroupClick(groupName: string) {
    selectedGroup = groupName;
    activeItem = ''; // Deselect nav items
    onGroupSelect(groupName);
    onStarredFilterToggle(false); // Turn off starred filter
  }
</script>

<aside class="w-64 h-full bg-background-primary border-r border-ghost flex flex-col pt-6 pb-4 relative overflow-hidden with-noise">
  <!-- Ambient glow background -->
  <div class="absolute top-0 left-0 w-full h-full bg-gradient-emerald pointer-events-none"></div>
  
  <!-- Glass overlay effect -->
  <div class="absolute inset-0 backdrop-blur-sm opacity-20 pointer-events-none"></div>

  <!-- Header with enhanced styling -->
  <div class="px-6 mb-6 flex items-center justify-between relative z-10">
    <div class="text-xl font-bold tracking-tight text-gradient-emerald">
      ZenFeed
    </div>
    <a 
      href="/settings" 
      class="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:text-accent-mint 
             transition-linear hover:bg-accent-emerald/15 hover:shadow-glow-sm border border-ghost"
      title="Add Source"
      aria-label="Add new feed source"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
    </a>
  </div>

  <!-- Today's Stats Card - Enhanced with card-elevated -->
  {#if todayReadCount > 0}
    <div class="mx-3 mb-6 p-4 card-elevated relative z-10 animate-slide-in-right border-emerald-900/30">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs text-text-secondary font-medium mb-1 uppercase tracking-widest opacity-75">
            📊 Today's Progress
          </div>
          <div class="text-3xl font-bold text-gradient-emerald">{todayReadCount}</div>
          <div class="text-xs text-text-muted mt-1">
            article{todayReadCount === 1 ? '' : 's'} read
          </div>
        </div>
        <div class="flex-shrink-0">
          <div class="w-14 h-14 rounded-full bg-gradient-to-br from-accent-emerald/20 to-accent-mint/10 
                        flex items-center justify-center border border-accent-mint/20 shadow-glow-sm">
            <svg class="w-7 h-7 text-accent-mint" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main Navigation -->
  <nav class="flex-1 px-3 space-y-1 overflow-y-auto relative z-10 scroller">
    {#each navItems as item}
      <button 
        class="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-linear 
                group relative indicator-bar {activeItem === item.id ? 'active' : ''}
                {activeItem === item.id 
                  ? 'text-accent-mint bg-accent-emerald/12 shadow-glow-sm border border-accent-mint/30' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-accent-emerald/8 border border-ghost hover:border-accent-emerald/20'}"
        onclick={() => handleNavClick(item.id)}
        aria-current={activeItem === item.id ? 'page' : undefined}
      >
        <svg class="mr-3 ml-0 flex-shrink-0 h-5 w-5 transition-colors {activeItem === item.id ? 'text-accent-mint' : 'text-text-muted group-hover:text-accent-emerald'}" 
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon}></path>
        </svg>
        <span>{item.label}</span>
      </button>
    {/each}

    <!-- Feed Groups Separator -->
    <div class="pt-4 pb-2 px-3 mt-3 border-t border-ghost">
      <h3 class="text-xs font-semibold text-text-muted uppercase tracking-widest opacity-70 flex items-center gap-2">
        <span>📚 Feeds</span>
        {#if groups.length > 0}
          <span class="ml-auto text-[10px] badge-emerald">{groups.length}</span>
        {/if}
      </h3>
    </div>
    
    <!-- Dynamic Feed Groups -->
    {#if groups.length > 0}
      {#each groups as groupName (groupName)}
        <button 
          class="w-full flex items-center pl-6 pr-3 py-2 text-sm font-medium rounded-md transition-linear
                  group relative indicator-bar {selectedGroup === groupName ? 'active' : ''}
                  {selectedGroup === groupName
                    ? 'text-accent-mint bg-accent-emerald/12 shadow-glow-sm border border-accent-mint/30' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-accent-emerald/8 border border-ghost hover:border-accent-emerald/20'}"
          onclick={() => handleGroupClick(groupName)}
          aria-current={selectedGroup === groupName ? 'page' : undefined}
        >
          <svg class="mr-3 flex-shrink-0 h-4 w-4 transition-colors {selectedGroup === groupName ? 'text-accent-mint' : 'text-text-muted group-hover:text-accent-emerald'}" 
               fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 7h.01M7 3h5c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1zm0 8h10c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-6c0-.55.45-1 1-1z"></path>
          </svg>
          <span class="truncate flex-1">{groupName}</span>
        </button>
      {/each}
    {:else}
      <div class="px-3 py-3 text-xs text-text-muted italic opacity-60 text-center">
        <p>No feeds added yet</p>
        <p class="text-[11px] mt-1 opacity-70">Visit settings to add sources</p>
      </div>
    {/if}
  </nav>
  
  <!-- Footer - Glassmorphic User Card -->
  <div class="px-4 py-4 border-t border-ghost relative z-10">
    <div class="flex items-center p-2.5 rounded-lg glassmorphic group hover:border-accent-mint/50 cursor-pointer">
      <!-- Avatar -->
      <div class="h-10 w-10 rounded-full bg-gradient-to-br from-accent-mint to-accent-emerald p-[2px] flex-shrink-0">
        <div class="bg-background-primary w-full h-full rounded-full flex items-center justify-center 
                    text-xs font-bold text-accent-mint group-hover:text-accent-lime transition-colors">
          A
        </div>
      </div>
      <!-- User Info -->
      <div class="ml-3 flex-1 min-w-0">
        <p class="text-sm font-semibold text-text-primary group-hover:text-accent-mint transition-colors truncate">
          Admin
        </p>
        <p class="text-xs text-text-muted group-hover:text-text-secondary transition-colors truncate">
          Pro Plan
        </p>
      </div>
    </div>
  </div>
</aside>

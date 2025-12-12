<script lang="ts">
  import { onMount } from 'svelte';
  import { queryFeedsStore } from '$lib/stores/feedStore';
  import { readItemsStore } from '$lib/stores/readStateStore';
  import { groupFeedsByLabel } from '$lib/utils/feedUtils';
  
  export let activeItem = 'inbox';
  export let selectedGroup: string | null = null;
  export let onGroupSelect: (groupName: string) => void = () => {};

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
</script>

<aside class="w-64 h-full bg-background-secondary/80 backdrop-blur-xl border-r border-border-subtle flex flex-col pt-6 pb-4 relative overflow-hidden">
  <!-- Subtle background glow - now green -->
  <div class="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-accent-emerald/5 to-transparent pointer-events-none"></div>

  <!-- Header -->
  <div class="px-6 mb-6 flex items-center justify-between relative z-10">
    <div class="text-xl font-bold tracking-tight text-gradient-green">
      ZenFeed
    </div>
    <button class="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-accent-emerald hover:bg-accent-emerald/10 transition-all duration-300 glow-hover">
      <!-- Simple plus icon -->
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
    </button>
  </div>

  <!-- Today's Stats Card -->
  {#if todayReadCount > 0}
    <div class="mx-3 mb-6 p-3 bg-accent-emerald/5 border border-accent-emerald/20 rounded-lg relative z-10 animate-fade-in">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs text-text-secondary mb-0.5">Today's Progress</div>
          <div class="text-2xl font-bold text-accent-emerald">{todayReadCount}</div>
          <div class="text-[10px] text-text-muted">article{todayReadCount === 1 ? '' : 's'} read</div>
        </div>
        <div class="w-12 h-12 rounded-full bg-accent-emerald/10 flex items-center justify-center">
          <svg class="w-6 h-6 text-accent-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main Nav -->
  <nav class="flex-1 px-3 space-y-1 overflow-y-auto relative z-10">
    {#each navItems as item}
      <button 
        class="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 group relative
        {activeItem === item.id 
          ? 'text-accent-emerald bg-accent-emerald/10 shadow-[0_0_15px_-3px_rgba(16,163,127,0.3)]' 
          : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}"
        on:click={() => {
          activeItem = item.id;
          selectedGroup = null;
        }}
      >
        <!-- Active indicator line - green -->
        {#if activeItem === item.id}
          <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent-emerald rounded-r shadow-[0_0_8px_var(--accent-emerald)]"></div>
        {/if}

        <svg class="mr-3 ml-1 flex-shrink-0 h-5 w-5 transition-colors {activeItem === item.id ? 'text-accent-emerald' : 'text-text-muted group-hover:text-text-primary'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon}></path>
        </svg>
        {item.label}
      </button>
    {/each}

    <!-- Divider -->
    <div class="pt-6 pb-2 px-3">
      <h3 class="text-[10px] font-bold text-text-muted uppercase tracking-widest opacity-70">
        Feeds
      </h3>
    </div>
    
    <!-- Dynamic Groups / Feeds from API -->
    {#if groups.length > 0}
      {#each groups as groupName}
        <button 
          class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all
          {selectedGroup === groupName
            ? 'text-accent-mint bg-accent-mint/10 shadow-[0_0_10px_-4px_rgba(110,231,183,0.3)]'
            : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}"
          on:click={() => {
            selectedGroup = groupName;
            onGroupSelect(groupName);
          }}
        >
          <span class="mr-3 flex-shrink-0 w-4 flex justify-center text-xs opacity-60">#</span>
          <span class="truncate">{groupName}</span>
        </button>
      {/each}
    {:else}
      <div class="px-3 py-2 text-xs text-text-muted italic opacity-50">
        No feeds available
      </div>
    {/if}
  </nav>
  
  <!-- Footer / User -->
  <div class="px-4 py-4 border-t border-border-subtle relative z-10 bg-background-secondary/50">
    <div class="flex items-center p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
      <div class="h-9 w-9 rounded-full bg-gradient-to-br from-accent-emerald to-accent-mint p-[1px]">
        <div class="bg-background-secondary w-full h-full rounded-full flex items-center justify-center text-xs font-bold text-white relative overflow-hidden">
             <!-- Avatar Image or Text -->
             A
        </div>
      </div>
      <div class="ml-3">
        <p class="text-sm font-medium text-text-primary group-hover:text-accent-emerald transition-colors">Admin</p>
        <p class="text-xs text-text-secondary">Pro Plan</p>
      </div>
    </div>
  </div>
</aside>

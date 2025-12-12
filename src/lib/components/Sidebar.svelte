<script lang="ts">
  import { onMount } from 'svelte';
  
  export let activeItem = 'inbox'; // 'inbox', 'saved', etc.

  // Placeholder data for sidebar navigation
  const navItems = [
    { id: 'inbox', label: 'Inbox', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
    { id: 'start', label: 'Starred', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  ];
  
  const folders = [
    { id: 'tech', label: 'Tech News' },
    { id: 'design', label: 'Design' },
    { id: 'dev', label: 'Development' },
  ];
</script>

<aside class="w-64 h-full bg-background-secondary border-r border-border-subtle flex flex-col pt-6 pb-4">
  <!-- Header -->
  <div class="px-6 mb-8 flex items-center justify-between">
    <div class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
      ZenFeed
    </div>
    <button class="text-text-muted hover:text-text-primary transition-colors">
      <!-- Simple plus icon -->
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
    </button>
  </div>

  <!-- Main Nav -->
  <nav class="flex-1 px-3 space-y-1">
    {#each navItems as item}
      <button 
        class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 group
        {activeItem === item.id 
          ? 'bg-background-tertiary text-text-primary shadow-sm' 
          : 'text-text-secondary hover:bg-background-tertiary/50 hover:text-text-primary'}"
        on:click={() => activeItem = item.id}
      >
        <svg class="mr-3 flex-shrink-0 h-5 w-5 {activeItem === item.id ? 'text-accent' : 'text-text-muted group-hover:text-text-primary'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon}></path>
        </svg>
        {item.label}
      </button>
    {/each}

    <!-- Divider -->
    <div class="pt-6 pb-2 px-3">
      <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wider">
        Feeds
      </h3>
    </div>
    
    <!-- Folders / Feeds -->
    {#each folders as folder}
      <button 
        class="w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors text-text-secondary hover:bg-background-tertiary/50 hover:text-text-primary"
      >
        <span class="mr-3 flex-shrink-0 h-4 w-4 flex items-center justify-center text-text-muted">
           #
        </span>
        {folder.label}
      </button>
    {/each}
  </nav>
  
  <!-- Footer / User -->
  <div class="px-4 py-4 border-t border-border-subtle">
    <div class="flex items-center">
      <div class="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
        A
      </div>
      <div class="ml-3">
        <p class="text-sm font-medium text-text-primary">Admin</p>
        <p class="text-xs text-text-muted">Pro Plan</p>
      </div>
    </div>
  </div>
</aside>

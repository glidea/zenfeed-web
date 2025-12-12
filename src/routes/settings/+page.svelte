<script lang="ts">
  import { onMount } from 'svelte';
  import { getTargetApiUrl } from '$lib/utils/apiUtils';
  
  let feeds: any[] = [];
  let isLoading = false;
  let error: string | null = null;
  
  // Add feed form
  let newFeedType: 'RSSHub' | 'URL' | 'OPML' = 'RSSHub';
  let newFeedValue = '';
  let newFeedName = '';
  let isAdding = false;
  
  onMount(async () => {
    await loadFeeds();
  });
  
  async function loadFeeds() {
    isLoading = true;
    error = null;
    try {
      // Fetch the current app config which includes sources
      const response = await fetch(getTargetApiUrl("/query_config"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      if (data && data.scrape && data.scrape.sources) {
        // Convert sources to feeds format for display
        feeds = data.scrape.sources.map((source: any, index: number) => ({
          id: source.name || `feed-${index}`,
          name: source.name || 'Unnamed',
          url: source.rss?.url || source.rss?.rsshub_route_path || '',
          type: source.rss?.url ? 'URL' : (source.rss?.rsshub_route_path ? 'RSSHub' : 'Unknown')
        }));
      } else {
        feeds = [];
      }
    } catch (e: any) {
      console.error('Error loading feeds:', e);
      error = `Failed to load feeds: ${e.message}`;
      feeds = [];
    } finally {
      isLoading = false;
    }
  }
  
  async function addFeed() {
    if (!newFeedValue) return;
    
    isAdding = true;
    error = null;
    try {
      // First, fetch current config to get existing sources
      const configResponse = await fetch(getTargetApiUrl("/query_config"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const currentConfig = await configResponse.json();
      
      // Initialize scrape.sources if it doesn't exist
      if (!currentConfig.scrape) {
        currentConfig.scrape = {};
      }
      if (!currentConfig.scrape.sources) {
        currentConfig.scrape.sources = [];
      }
      
      // Create new source based on feed type
      const newSource: any = {
        name: newFeedName || newFeedValue
      };
      
      if (newFeedType === 'RSSHub') {
        newSource.rss = {
          rsshub_route_path: newFeedValue
        };
      } else if (newFeedType === 'URL') {
        newSource.rss = {
          url: newFeedValue
        };
      }
      
      // Add new source to the list
      currentConfig.scrape.sources.push(newSource);
      
      // Apply the updated config
      const applyResponse = await fetch(getTargetApiUrl("/apply_config"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig)
      });
      
      if (!applyResponse.ok) {
        const errorText = await applyResponse.text();
        throw new Error(`Failed to apply config: ${errorText}`);
      }
      
      // Reset form
      newFeedValue = '';
      newFeedName = '';
      error = null;
      
      // Reload feeds
      await loadFeeds();
      
      // Show success
      alert(`Successfully added feed: ${newFeedName || newFeedValue}`);
    } catch (e: any) {
      console.error('Error adding feed:', e);
      error = e.message || 'Failed to add feed. Please check the console for details.';
    } finally {
      isAdding = false;
    }
  }
  
  async function deleteFeed(feedId: string) {
    if (!confirm('Are you sure you want to delete this feed?')) return;
    
    try {
      // First, fetch current config
      const configResponse = await fetch(getTargetApiUrl("/query_config"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const currentConfig = await configResponse.json();
      
      // Remove the source with matching name/id
      if (currentConfig.scrape && currentConfig.scrape.sources) {
        currentConfig.scrape.sources = currentConfig.scrape.sources.filter(
          (source: any) => source.name !== feedId
        );
      }
      
      // Apply the updated config
      const applyResponse = await fetch(getTargetApiUrl("/apply_config"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig)
      });
      
      if (!applyResponse.ok) {
        const errorText = await applyResponse.text();
        throw new Error(`Failed to delete feed: ${errorText}`);
      }
      
      // Reload feeds
      await loadFeeds();
    } catch (e: any) {
      console.error('Error deleting feed:', e);
      error = e.message || 'Failed to delete feed';
    }
  }
</script>

<svelte:head>
  <title>Settings - ZenFeed</title>
</svelte:head>

<div class="min-h-screen bg-background-primary relative overflow-hidden">
  <!-- Animated Background -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none">
    <div class="absolute top-0 left-1/4 w-96 h-96 bg-accent-emerald/5 rounded-full blur-3xl animate-pulse"></div>
    <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-mint/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
  </div>

  <!-- Header -->
  <header class="border-b border-border-subtle bg-background-secondary/50 backdrop-blur-xl sticky top-0 z-20">
    <div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <a 
          href="/" 
          class="p-2 -ml-2 text-text-secondary hover:text-accent-emerald transition-all duration-300 hover:bg-accent-emerald/10 rounded-lg group"
          aria-label="Back to home"
        >
          <svg class="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
        </a>
        <h1 class="text-2xl font-bold text-gradient-green">Settings</h1>
      </div>
      <div class="flex items-center space-x-2">
        <span class="text-xs text-text-muted">ZenFeed v0.7.0</span>
      </div>
    </div>
  </header>

  <main class="max-w-[1400px] mx-auto px-8 py-16 relative z-10">
    <!-- Two Column Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
      <!--Left Column: Add Feed Section -->
      <section>
        <div class="mb-6">
          <h2 class="text-2xl font-bold text-text-primary mb-2">Add New Feed Source</h2>
          <p class="text-text-secondary text-sm">Connect your favorite RSS feeds and stay updated</p>
        </div>
        
        {#if error}
          <div class="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 backdrop-blur-sm animate-shake">
            <div class="flex items-center space-x-2">
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>{error}</span>
            </div>
          </div>
        {/if}
        
        <div class="bg-gradient-to-br from-background-secondary/80 to-background-secondary/40 border border-border-subtle/50 rounded-2xl p-6 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(16,163,127,0.15)] transition-all duration-500">
          <!-- Feed Type Tabs -->
          <div class="flex gap-2 mb-6 p-1 bg-background-tertiary/50 rounded-xl">
            <button 
              class="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 {newFeedType === 'RSSHub' ? 'bg-gradient-to-r from-accent-emerald to-accent-mint text-white shadow-[0_4px_12px_rgba(16,163,127,0.3)]' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}"
              onclick={() => newFeedType = 'RSSHub'}
              title="Add by RSSHub Path"
            >
              <div class="flex items-center justify-center space-x-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <span>RSSHub</span>
              </div>
            </button>
            <button 
              class="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 {newFeedType === 'URL' ? 'bg-gradient-to-r from-accent-emerald to-accent-mint text-white shadow-[0_4px_12px_rgba(16,163,127,0.3)]' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}"
              onclick={() => newFeedType = 'URL'}
              title="Add by Feed URL"
            >
              <div class="flex items-center justify-center space-x-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                </svg>
                <span>URL</span>
              </div>
            </button>
            <button 
              class="flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 {newFeedType === 'OPML' ? 'bg-gradient-to-r from-accent-emerald to-accent-mint text-white shadow-[0_4px_12px_rgba(16,163,127,0.3)]' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}"
              onclick={() => newFeedType = 'OPML'}
              title="Import OPML File"
            >
              <div class="flex items-center justify-center space-x-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span>OPML</span>
              </div>
            </button>
          </div>
          
          <!-- Feed Input -->
          <div class="space-y-4">
            {#if newFeedType === 'OPML'}
              <div>
                <label class="mb-2 text-sm font-semibold text-text-primary flex items-center space-x-2">
                  <svg class="w-4 h-4 text-accent-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                  </svg>
                  <span>Upload OPML File</span>
                </label>
                <input 
                  type="file" 
                  accept=".opml,.xml"
                  class="w-full px-4 py-3 bg-background-tertiary/70 border-2 border-border-subtle rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-emerald/50 focus:bg-background-tertiary transition-all duration-300 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-accent-emerald/10 file:text-accent-emerald file:text-xs file:font-medium hover:file:bg-accent-emerald/20"
                />
                <p class="mt-2 text-xs text-text-muted flex items-center space-x-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>Import from other RSS readers</span>
                </p>
              </div>
            {:else}
              <div>
                <label class="mb-2 text-sm font-semibold text-text-primary flex items-center space-x-2">
                  <svg class="w-4 h-4 text-accent-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                  </svg>
                  <span>{newFeedType === 'RSSHub' ? 'RSSHub Path' : 'Feed URL'}</span>
                </label>
                <input 
                  type="text" 
                  bind:value={newFeedValue}
                  placeholder={newFeedType === 'RSSHub' ? 'e.g., sspai/index' : 'e.g., https://sspai.com/feed'}
                  class="w-full px-4 py-3 bg-background-tertiary/70 border-2 border-border-subtle rounded-xl text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent-emerald/50 focus:bg-background-tertiary focus:shadow-[0_0_0_3px_rgba(16,163,127,0.1)] transition-all duration-300"
                />
                {#if newFeedType === 'RSSHub'}
                  <p class="mt-2 text-xs text-text-muted flex items-center space-x-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Browse routes at <a href="https://docs.rsshub.app" target="_blank" class="text-accent-emerald hover:text-accent-mint underline">RSSHub Docs</a></span>
                  </p>
                {/if}
              </div>
              
              <div>
                <label class="mb-2 text-sm font-semibold text-text-primary flex items-center space-x-2">
                  <svg class="w-4 h-4 text-accent-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                  </svg>
                  <span>Feed Name <span class="text-text-muted font-normal text-xs">(Optional)</span></span>
                </label>
                <input 
                  type="text" 
                  bind:value={newFeedName}
                  placeholder="e.g., 少数派"
                  class="w-full px-4 py-3 bg-background-tertiary/70 border-2 border-border-subtle rounded-xl text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent-emerald/50 focus:bg-background-tertiary focus:shadow-[0_0_0_3px_rgba(16,163,127,0.1)] transition-all duration-300"
                />
              </div>
              
              <button 
                onclick={addFeed}
                disabled={isAdding || !newFeedValue}
                class="w-full px-6 py-3 bg-gradient-to-r from-accent-emerald to-accent-mint hover:from-accent-emerald/90 hover:to-accent-mint/90 disabled:from-accent-emerald/30 disabled:to-accent-mint/30 text-white rounded-xl font-semibold text-sm transition-all duration-300 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(16,163,127,0.3)] hover:shadow-[0_8px_30px_rgba(16,163,127,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:shadow-none disabled:transform-none flex items-center justify-center space-x-2"
                title={isAdding ? 'Please wait...' : 'Add this feed source'}
              >
                {#if isAdding}
                  <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  <span>Adding...</span>
                {:else}
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  <span>Add Feed Source</span>
                {/if}
              </button>
            {/if}
          </div>
        </div>
      </section>

      <!-- Right Column: Current Feeds -->
      <section>
        <div class="mb-6">
          <h2 class="text-2xl font-bold text-text-primary mb-2">Your Feed Sources</h2>
          <p class="text-text-secondary text-sm">Manage your connected feeds</p>
        </div>
        
        {#if isLoading}
          <div class="text-center py-20">
            <div class="w-12 h-12 border-4 border-accent-emerald/20 border-t-accent-emerald rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-text-secondary text-sm font-medium">Loading your feeds...</p>
          </div>
        {:else if feeds.length === 0}
          <div class="bg-gradient-to-br from-background-secondary/50 to-background-secondary/20 border-2 border-dashed border-border-subtle rounded-2xl p-12 text-center backdrop-blur-sm">
            <div class="w-16 h-16 mx-auto mb-4 bg-accent-emerald/10 rounded-2xl flex items-center justify-center">
              <svg class="w-8 h-8 text-accent-emerald/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
              </svg>
            </div>
            <h3 class="text-lg font-bold text-text-primary mb-2">No feed sources yet</h3>
            <p class="text-text-secondary text-sm mb-4">Add your first feed source to get started</p>
            <div class="inline-flex items-center space-x-2 text-xs text-accent-emerald">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
              <span class="font-medium">Get started now!</span>
            </div>
          </div>
        {:else}
          <div class="space-y-3 max-h-[600px] overflow-y-auto scroller pr-2">
            {#each feeds as feed, index}
              <div 
                class="bg-gradient-to-br from-background-secondary/70 to-background-secondary/30 border border-border-subtle hover:border-accent-emerald/40 rounded-xl p-4 flex items-center justify-between group transition-all duration-300 hover:shadow-[0_8px_30px_rgba(16,163,127,0.1)] backdrop-blur-sm animate-slide-up"
                style="animation-delay: {index * 30}ms"
              >
                <div class="flex-1 flex items-center space-x-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-accent-emerald/20 to-accent-mint/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg class="w-5 h-5 text-accent-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z"/>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2 mb-1">
                      <span class="px-2 py-0.5 bg-accent-emerald/15 text-accent-emerald text-[10px] font-bold rounded-full uppercase tracking-wide">
                        {feed.type || 'RSSHub'}
                      </span>
                      <h3 class="font-bold text-text-primary text-sm truncate">{feed.name || feed.url}</h3>
                    </div>
                    <p class="text-xs text-text-secondary truncate font-mono">{feed.url}</p>
                  </div>
                </div>
                <button 
                  onclick={() => deleteFeed(feed.id)}
                  class="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 ml-2"
                  title="Delete this feed"
                  aria-label="Delete feed"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </main>
</div>

<style>
  .text-gradient-green {
    background: linear-gradient(120deg, var(--accent-emerald) 0%, var(--accent-mint) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  
  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }
  
  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-slide-up {
    animation: slide-up 0.5s ease-out forwards;
    opacity: 0;
  }
  
  .delay-1000 {
    animation-delay: 1s;
  }
</style>


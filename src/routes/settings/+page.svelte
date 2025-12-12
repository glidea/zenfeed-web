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
      // TODO: Implement actual feed list API
      const response = await fetch(getTargetApiUrl("/feeds"));
      if (response.ok) {
        feeds = await response.json();
      }
    } catch (e: any) {
      console.error(e);
      error = e.message;
    } finally {
      isLoading = false;
    }
  }
  
  async function addFeed() {
    if (!newFeedValue) return;
    
    isAdding = true;
    error = null;
    try {
      // TODO: Implement actual add feed API
      const response = await fetch(getTargetApiUrl("/addFeed"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newFeedType,
          value: newFeedValue,
          name: newFeedName || undefined
        })
      });
      
      if (response.ok) {
        // Reset form
        newFeedValue = '';
        newFeedName = '';
        // Reload feeds
        await loadFeeds();
      } else {
        throw new Error('Failed to add feed');
      }
    } catch (e: any) {
      console.error(e);
      error = e.message;
    } finally {
      isAdding = false;
    }
  }
  
  async function deleteFeed(feedId: string) {
    if (!confirm('Are you sure you want to delete this feed?')) return;
    
    try {
      const response = await fetch(getTargetApiUrl(`/deleteFeed/${feedId}`), {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadFeeds();
      }
    } catch (e: any) {
      console.error(e);
      error = e.message;
    }
  }
</script>

<svelte:head>
  <title>Settings - ZenFeed</title>
</svelte:head>

<div class="min-h-screen bg-background-primary">
  <!-- Header -->
  <header class="border-b border-border-subtle bg-background-secondary/80 backdrop-blur-xl sticky top-0 z-10">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <a href="/" class="text-text-secondary hover:text-accent-emerald transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
        </a>
        <h1 class="text-2xl font-bold text-gradient-green">Settings</h1>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-6 py-8">
    <!-- Add Feed Section -->
    <section class="mb-12">
      <h2 class="text-xl font-bold text-text-primary mb-6">Add New Feed Source</h2>
      
      {#if error}
        <div class="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      {/if}
      
      <div class="bg-background-secondary/50 border border-border-subtle rounded-xl p-6">
        <!-- Feed Type Tabs -->
        <div class="flex gap-2 mb-6">
          <button 
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {newFeedType === 'RSSHub' ? 'bg-accent-emerald text-white' : 'bg-background-tertiary text-text-secondary hover:text-text-primary'}"
            onclick={() => newFeedType = 'RSSHub'}
          >
            按 RSSHub 路径添加
          </button>
          <button 
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {newFeedType === 'URL' ? 'bg-accent-emerald text-white' : 'bg-background-tertiary text-text-secondary hover:text-text-primary'}"
            onclick={() => newFeedType = 'URL'}
          >
            按 URL 添加
          </button>
          <button 
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {newFeedType === 'OPML' ? 'bg-accent-emerald text-white' : 'bg-background-tertiary text-text-secondary hover:text-text-primary'}"
            onclick={() => newFeedType = 'OPML'}
          >
            导入 OPML 文件
          </button>
        </div>
        
        <!-- Feed Input -->
        <div class="space-y-4">
          {#if newFeedType === 'OPML'}
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-2">
                Upload OPML File
              </label>
              <input 
                type="file" 
                accept=".opml,.xml"
                class="w-full px-4 py-2 bg-background-tertiary border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-emerald/50"
              />
              <p class="mt-2 text-xs text-text-muted">
                从此处理后: Follow
              </p>
            </div>
          {:else}
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-2">
                {newFeedType === 'RSSHub' ? 'RSSHub 路径' : 'Feed URL'}
              </label>
              <input 
                type="text" 
                bind:value={newFeedValue}
                placeholder={newFeedType === 'RSSHub' ? 'e.g., cosplaytele/category/category' : 'e.g., https://sspai.com/feed'}
                class="w-full px-4 py-2 bg-background-tertiary border border-border-subtle rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-emerald/50"
              />
              {#if newFeedType === 'RSSHub'}
                <p class="mt-2 text-xs text-text-muted">
                  查看: RSSHub
                </p>
              {/if}
            </div>
            
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-2">
                Feed Name (Optional)
              </label>
              <input 
                type="text" 
                bind:value={newFeedName}
                placeholder="e.g., 少数派"
                class="w-full px-4 py-2 bg-background-tertiary border border-border-subtle rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-emerald/50"
              />
            </div>
            
            <button 
              onclick={addFeed}
              disabled={isAdding || !newFeedValue}
              class="px-6 py-2.5 bg-accent-emerald hover:bg-accent-emerald/80 disabled:bg-accent-emerald/30 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isAdding ? 'Adding...' : 'Add Feed'}
            </button>
          {/if}
        </div>
      </div>
    </section>

    <!-- Current Feeds -->
    <section>
      <h2 class="text-xl font-bold text-text-primary mb-6">Your Feed Sources</h2>
      
      {#if isLoading}
        <div class="text-center py-12 text-text-secondary">
          <div class="w-8 h-8 border-4 border-accent-emerald/30 border-t-accent-emerald rounded-full animate-spin mx-auto mb-4"></div>
          Loading feeds...
        </div>
      {:else if feeds.length === 0}
        <div class="bg-background-secondary/30 border border-border-subtle rounded-xl p-12 text-center">
          <svg class="w-16 h-16 mx-auto mb-4 text-text-muted opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
          </svg>
          <p class="text-text-secondary">No feed sources yet</p>
          <p class="text-sm text-text-muted mt-2">Add your first feed source above to get started</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each feeds as feed}
            <div class="bg-background-secondary/50 border border-border-subtle hover:border-accent-emerald/30 rounded-xl p-4 flex items-center justify-between group transition-all">
              <div class="flex-1">
                <div class="flex items-center space-x-3 mb-1">
                  <span class="px-2 py-0.5 bg-accent-emerald/10 text-accent-emerald text-xs font-medium rounded">
                    {feed.type || 'RSSHub'}
                  </span>
                  <h3 class="font-semibold text-text-primary">{feed.name || feed.url}</h3>
                </div>
                <p class="text-sm text-text-secondary truncate">{feed.url}</p>
              </div>
              <button 
                onclick={() => deleteFeed(feed.id)}
                class="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                aria-label="Delete feed"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </main>
</div>

<style>
  .text-gradient-green {
    background: linear-gradient(120deg, var(--accent-emerald) 0%, var(--accent-mint) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
</style>

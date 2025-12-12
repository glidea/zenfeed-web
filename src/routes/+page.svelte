<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import ArticleList from '$lib/components/ArticleList.svelte';
  import ArticleReader from '$lib/components/ArticleReader.svelte';
  import { queryFeedsStore } from '$lib/stores/feedStore';
  import { getTargetApiUrl } from '$lib/utils/apiUtils';
  import { _ } from 'svelte-i18n';

  let activeItem = 'inbox';
  let selectedGroup: string | null = null;
  let isLoading = false;
  let error: string | null = null;
  
  function handleGroupSelect(groupName: string) {
    selectedGroup = groupName;
    activeItem = ''; // Deselect nav items
  }
  
  async function fetchFeeds() {
    isLoading = true;
    error = null;
    try {
        const now = new Date();
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const response = await fetch(getTargetApiUrl("/query"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                start: past24h.toISOString(),
                end: now.toISOString(),
                limit: 500,
                query: "",
                summarize: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to load feeds: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        queryFeedsStore.set(data);
        
    } catch (e: any) {
        console.error(e);
        error = e.message;
        queryFeedsStore.set(null);
    } finally {
        isLoading = false;
    }
  }

  onMount(() => {
    fetchFeeds();
  });
</script>

{#if isLoading}
  <!-- Loading State -->
  <div class="flex-1 flex items-center justify-center bg-background-primary">
    <div class="flex flex-col items-center space-y-4">
      <div class="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
      <p class="text-text-secondary text-sm">Loading articles...</p>
    </div>
  </div>
{:else if error}
  <!-- Error State -->
  <div class="flex-1 flex items-center justify-center bg-background-primary p-8">
    <div class="max-w-md w-full bg-background-secondary border border-red-500/30 rounded-xl p-6">
      <div class="flex items-start space-x-3">
        <svg class="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <div class="flex-1">
          <h3 class="text-text-primary font-semibold mb-1">Error Loading Feeds</h3>
          <p class="text-text-muted text-sm mb-4">{error}</p>
          <button 
            onclick={fetchFeeds}
            class="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- Main Content -->
  <Sidebar 
    bind:activeItem 
    bind:selectedGroup
    onGroupSelect={handleGroupSelect}
  />
  <ArticleList {selectedGroup} />
  <ArticleReader />
{/if}

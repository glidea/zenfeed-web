<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import ArticleList from '$lib/components/ArticleList.svelte';
  import ArticleReader from '$lib/components/ArticleReader.svelte';
  import { queryFeedsStore } from '$lib/stores/feedStore';
  import { getTargetApiUrl } from '$lib/utils/apiUtils';
  import { _ } from 'svelte-i18n';

  let activeItem = 'inbox'; // For Sidebar state
  let isLoading = false;
  let error: string | null = null;
  
  async function fetchFeeds() {
    isLoading = true;
    error = null;
    try {
        const now = new Date();
        const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Simple default query for "Inbox" / "Past 24h"
        const response = await fetch(getTargetApiUrl("/query"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                start: past24h.toISOString(),
                end: now.toISOString(),
                limit: 500,
                query: "", // all
                summarize: false, // Don't need summary for list, but maybe for reader?
                // actually reader needs content. API probably returns it in labels.summary_html_snippet
            }),
        });

        if (!response.ok) throw new Error("Failed to load feeds");
        
        const data = await response.json();
        
        // Populate store
        queryFeedsStore.set(data);
        
    } catch (e: any) {
        console.error(e);
        error = e.message;
    } finally {
        isLoading = false;
    }
  }

  onMount(() => {
    fetchFeeds();
  });
</script>

<Sidebar bind:activeItem />
<ArticleList />
<ArticleReader />

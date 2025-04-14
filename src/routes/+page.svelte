<script lang="ts">
    import Past24h from "$lib/components/Past24h.svelte";
    import Notifications from "$lib/components/Notifications.svelte";
    import AdvancedConfig from "$lib/components/AdvancedConfig.svelte";
    import LanguageSwitcher from "$lib/components/LanguageSwitcher.svelte";
    import { _ } from "svelte-i18n"; // Import the translation function

    let activeTab = $state<"past" | "notifications" | "advanced">("past");

    function setActiveTab(tab: "past" | "notifications" | "advanced") {
        activeTab = tab;
    }
</script>

<div class="container mx-auto p-4">
    <div role="tablist" class="tabs tabs-bordered mb-6 pl-8">
        <a
            role="tab"
            class="tab pl-4 {activeTab === 'past' ? 'tab-active' : ''}"
            onclick={() => setActiveTab("past")}
            onkeypress={(e) => e.key === "Enter" && setActiveTab("past")}
            tabindex={activeTab === "past" ? 0 : -1}
        >
            {$_("tabs.past24h")}
        </a>
        <a
            role="tab"
            class="tab pl-4 {activeTab === 'notifications' ? 'tab-active' : ''}"
            onclick={() => setActiveTab("notifications")}
            onkeypress={(e) =>
                e.key === "Enter" && setActiveTab("notifications")}
            tabindex={activeTab === "notifications" ? 0 : -1}
        >
            {$_("tabs.notifications")}
        </a>
        <a
            role="tab"
            class="tab pl-4 {activeTab === 'advanced' ? 'tab-active' : ''}"
            onclick={() => setActiveTab("advanced")}
            onkeypress={(e) => e.key === "Enter" && setActiveTab("advanced")}
            tabindex={activeTab === "advanced" ? 0 : -1}
        >
            {$_("tabs.advancedConfig")}
        </a>
        <div class="tab flex-grow justify-end">
            <LanguageSwitcher />
        </div>
    </div>

    <div>
        {#if activeTab === "past"}
            <Past24h />
        {:else if activeTab === "notifications"}
            <Notifications />
        {:else if activeTab === "advanced"}
            <AdvancedConfig />
        {/if}
    </div>
</div>

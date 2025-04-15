<script lang="ts">
    import Past24h from "$lib/components/Past24h.svelte";
    import Notifications from "$lib/components/Notifications.svelte";
    import AdvancedConfig from "$lib/components/AdvancedConfig.svelte";
    import SettingsModal from "$lib/components/SettingsModal.svelte";
    import { _ } from "svelte-i18n"; // Import the translation function

    let activeTab = $state<"past" | "notifications" | "advanced">("past");
    let showSettingsModal = $state(false);

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
            <button
                class="btn btn-ghost btn-circle"
                onclick={() => (showSettingsModal = true)}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-6 h-6"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.004.827c-.292.24-.437.613-.43.992a6.759 6.759 0 0 1 0 1.855c.007.378.138.75.43.99l1.005.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.333.183-.582.495-.645.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.759 6.759 0 0 1 0-1.855c-.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
                    />
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                </svg>
            </button>
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

{#if showSettingsModal}
    <SettingsModal bind:show={showSettingsModal} />
{/if}

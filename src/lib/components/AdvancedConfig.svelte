<script lang="ts">
    import { onMount } from "svelte";
    import * as yaml from "js-yaml";
    import { _ } from "svelte-i18n"; // Import the translation function
    import { apiUrl } from "$lib/stores/apiUrl";
    import { get } from "svelte/store";

    // Component State
    let yamlConfig = $state("");
    let isLoading = $state(true); // Loading state for initial fetch
    let error = $state<string | null>(null); // Error state for initial fetch
    let isSaving = $state(false); // Loading state for saving
    let saveError = $state<string | null>(null); // Error state specifically for saving
    let saveSuccessMessage = $state<string | null>(null); // Success message state for saving

    // --- Async Functions ---

    async function loadConfig() {
        isLoading = true;
        error = null;
        saveError = null; // Reset errors on load
        saveSuccessMessage = null;
        try {
            const baseUrl = get(apiUrl);
            const res = await fetch(`${baseUrl}/query_config`, {
                method: "POST",
            });
            if (!res.ok) {
                // Use translated string with interpolation
                throw new Error(
                    $_("advancedConfig.errorLoading", {
                        values: { error: `${res.status} ${res.statusText}` },
                    }),
                );
            }
            const configJson = await res.json();
            yamlConfig = yaml.dump(configJson);
        } catch (e: any) {
            // Use the error message directly if it's already translated, or provide a fallback
            error =
                e.message ||
                $_("advancedConfig.errorLoading", {
                    values: { error: "Unknown error" },
                });
            console.error("Error loading config:", e);
        } finally {
            isLoading = false;
        }
    }

    async function saveConfig() {
        isSaving = true;
        saveError = null;
        saveSuccessMessage = null; // Reset messages on new save attempt
        error = null;
        try {
            // Basic validation
            if (yamlConfig.trim() === "") {
                throw new Error($_("advancedConfig.emptyConfigError"));
            }
            const configJson = yaml.load(yamlConfig);
            if (typeof configJson !== "object" || configJson === null) {
                throw new Error($_("advancedConfig.invalidYamlError"));
            }

            // API Call
            const baseUrl = get(apiUrl);
            const res = await fetch(`${baseUrl}/apply_config`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(configJson),
            });

            // Handle Response
            if (!res.ok) {
                const errorText = await res.text();
                // Use translated string with interpolation
                throw new Error(
                    $_("advancedConfig.errorSaving", {
                        values: {
                            error: `${res.status} ${res.statusText}. ${errorText || "(No further details provided)"}`,
                        },
                    }),
                );
            }

            // Success Feedback
            saveSuccessMessage = $_("advancedConfig.saveSuccess");
            setTimeout(() => {
                saveSuccessMessage = null;
            }, 3000); // Clear message after 3 seconds
        } catch (e: any) {
            // Use the error message directly or provide a fallback
            saveError =
                e.message ||
                $_("advancedConfig.errorSaving", {
                    values: { error: "Unknown error" },
                });
            console.error("Error saving config with YAML:", yamlConfig, e);
        } finally {
            isSaving = false;
        }
    }

    // --- Lifecycle ---

    onMount(loadConfig);
</script>

<div class="card bg-base-200 shadow-xl">
    <div class="card-body">
        {#if isLoading}
            <!-- Loading State -->
            <div class="flex justify-center items-center h-96">
                <span class="loading loading-lg loading-spinner text-primary"
                ></span>
            </div>
        {:else if error}
            <!-- Error Loading State -->
            <div role="alert" class="alert alert-error mb-4">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    /></svg
                >
                <span>{error}</span>
            </div>
            <div class="card-actions justify-center">
                <button class="btn btn-secondary" onclick={loadConfig}
                    >{$_("advancedConfig.retryLoadButton")}</button
                >
            </div>
        {:else}
            <!-- Content Display State -->
            <textarea
                bind:value={yamlConfig}
                class="textarea textarea-bordered h-144 w-full font-mono text-sm mb-4"
                disabled={isSaving}
                placeholder={$_("advancedConfig.textareaPlaceholder")}
            ></textarea>

            {#if saveError}
                <!-- Error Saving State -->
                <div role="alert" class="alert alert-error mb-4">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="stroke-current shrink-0 h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        /></svg
                    >
                    <span>{saveError}</span>
                </div>
            {/if}

            <div class="card-actions justify-center mb-4">
                <button
                    class="btn btn-primary"
                    disabled={isSaving || yamlConfig.trim() === ""}
                    onclick={saveConfig}
                >
                    {#if isSaving}
                        <span class="loading loading-spinner loading-xs"></span>
                        {$_("advancedConfig.savingButton")}
                    {:else}
                        {$_("advancedConfig.saveButton")}
                    {/if}
                </button>
            </div>

            <!-- Save Success Toast (Positioned via CSS, placement in DOM is less critical) -->
            {#if saveSuccessMessage}
                <div class="toast toast-middle toast-center">
                    <div class="alert alert-success">
                        <span>{saveSuccessMessage}</span>
                    </div>
                </div>
            {/if}

            <div class="divider my-4">{$_("advancedConfig.helpDivider")}</div>

            <div class="text-sm text-base-content/70 space-y-1">
                <p>
                    {$_("advancedConfig.helpText1")}
                    <a
                        href="https://github.com/glidea/zenfeed/blob/main/docs/config.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link link-primary link-hover"
                        >{$_("advancedConfig.helpLink1")}</a
                    >.
                </p>
                <p>
                    {$_("advancedConfig.helpText2")}
                    <a
                        href="https://github.com/glidea/zenfeed/blob/main/docs/cherry-studio-mcp.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link link-primary link-hover"
                        >{$_("advancedConfig.helpLink2")}</a
                    >
                    {$_("advancedConfig.helpText3")}
                </p>
            </div>
        {/if}
    </div>
</div>

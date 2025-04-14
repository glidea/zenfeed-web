<script lang="ts">
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n"; // Import i18n function

    // --- Type Definitions ---
    interface AppConfig {
        scrape?: {
            sources?: ScrapeSource[];
            rsshub_endpoint?: string;
        };
    }

    interface ScrapeSource {
        name: string;
        rss?: {
            url?: string;
            rsshub_route_path?: string;
        };
        ui_id?: string; // Client-side temporary ID
        isDuplicate?: boolean; // Client-side flag for preview
    }

    // --- Component State ---
    let currentConfig: AppConfig | null = null;
    let sources: ScrapeSource[] = [];
    let isLoading = true;
    let error: string | null = null;
    let isSubmitting = false; // For general API calls (add/delete non-OPML)
    let submitError: string | null = null; // For general API call errors

    // --- Add Form State ---
    let addMode: "url" | "rsshub" | "opml" | null = null;
    let newSourceName = "";
    let newSourceUrl = "";
    let newSourceRsshubPath = "";
    let opmlFile: FileList | null = null;

    // --- OPML Import State ---
    let isParsingOpml = false;
    let showOpmlPreview = false;
    let opmlPreviewSources: ScrapeSource[] = [];
    let selectedOpmlSources = new Set<string>(); // Store ui_id of selected sources
    let opmlParseError: string | null = null;
    let isImportingOpml = false; // Specific state for OPML import submission

    // --- API Helper Function ---
    async function apiCall<T>(
        endpoint: string,
        method: "GET" | "POST",
        body?: any,
    ): Promise<T> {
        // ... (keep existing apiCall function)
        const options: RequestInit = {
            method: method,
            headers: {
                "Content-Type": "application/json",
            },
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(endpoint, options);

        if (!response.ok) {
            let errorDetail = await response.text();
            try {
                const jsonError = JSON.parse(errorDetail);
                errorDetail =
                    jsonError.message || jsonError.error || errorDetail;
            } catch (_) {
                /* ignore parsing error */
            }
            throw new Error(`API Error ${response.status}: ${errorDetail}`);
        }
        const text = await response.text();
        if (!text) {
            return {} as T;
        }
        try {
            return JSON.parse(text) as T;
        } catch (e) {
            throw new Error(`Failed to parse API response: ${e}`);
        }
    }

    // --- Core Functions ---
    async function fetchSources() {
        isLoading = true;
        error = null;
        try {
            console.log("Fetching sources config...");
            currentConfig = await apiCall<AppConfig>(
                "/api/query_config",
                "POST",
                {},
            );
            const fetchedSources = currentConfig?.scrape?.sources || [];
            sources = fetchedSources.map((source, index) => ({
                ...source,
                ui_id: `existing-${source.name}-${index}-${Date.now()}`, // Ensure uniqueness
            }));
            console.log("Sources config fetched:", sources);
        } catch (e: any) {
            console.error("Failed to fetch sources config:", e);
            error = e.message || $_("settings.sources.errorLoad");
            currentConfig = null;
            sources = [];
        } finally {
            isLoading = false;
        }
    }

    async function applyConfigChanges(
        updatedConfig: AppConfig,
        successMessage?: string,
    ) {
        // Use general isSubmitting for non-OPML, isImportingOpml for OPML
        const submittingFlag =
            addMode === "opml" ? "isImportingOpml" : "isSubmitting";
        if (addMode === "opml") isImportingOpml = true;
        else isSubmitting = true;

        submitError = null; // Clear general error
        opmlParseError = null; // Clear OPML specific error

        try {
            console.log("Applying config changes...");
            const configToSend = JSON.parse(JSON.stringify(updatedConfig));
            if (configToSend.scrape?.sources) {
                configToSend.scrape.sources.forEach((s: any) => {
                    delete s.ui_id;
                    delete s.isDuplicate; // Remove temporary UI flags
                });
            }

            await apiCall("/api/apply_config", "POST", configToSend);
            console.log("Config changes applied successfully.");
            if (successMessage) {
                // Maybe show a toast notification here in the future
                console.log(successMessage);
            }
            await fetchSources(); // Refetch to sync
            resetAddForm(); // Reset form/preview on success
        } catch (e: any) {
            console.error("Failed to apply config changes:", e);
            const errorMsg =
                e.message ||
                (addMode === "opml"
                    ? $_("settings.sources.opmlImportError")
                    : $_("settings.sources.errorAdd"));
            if (addMode === "opml") {
                opmlParseError = errorMsg; // Show error in OPML context
            } else {
                submitError = errorMsg; // Show error in regular add context
            }
        } finally {
            if (addMode === "opml") isImportingOpml = false;
            else isSubmitting = false;
        }
    }

    async function deleteSource(ui_id: string | undefined) {
        if (!ui_id || !currentConfig) return;
        if (!confirm($_("settings.sources.confirmDelete"))) return;

        const sourceToDelete = sources.find((s) => s.ui_id === ui_id);
        if (!sourceToDelete) {
            submitError = "Source not found for deletion.";
            return;
        }

        // Find the original source based on content match if needed, or just filter the current full config
        const updatedSources = (currentConfig.scrape?.sources || []).filter(
            (s) =>
                s.name !== sourceToDelete.name || // Simple name-based deletion for now
                (s.rss?.url && s.rss.url !== sourceToDelete.rss?.url) ||
                (s.rss?.rsshub_route_path &&
                    s.rss.rsshub_route_path !==
                        sourceToDelete.rss?.rsshub_route_path),
        );

        const updatedConfig: AppConfig = {
            ...currentConfig,
            scrape: {
                ...(currentConfig.scrape || {}),
                sources: updatedSources,
            },
        };

        await applyConfigChanges(updatedConfig);
    }

    // --- Add Source (URL/RSSHub) ---
    async function handleAddSource() {
        if (!currentConfig) {
            submitError =
                "Cannot add source: current configuration not loaded.";
            return;
        }
        if (addMode === "opml") {
            // Should not happen via this button, but safeguard
            handleConfirmOpmlImport();
            return;
        }

        submitError = null;
        let newSourceData: ScrapeSource | null = null;

        try {
            switch (addMode) {
                case "url":
                    // ... (keep existing url validation and data creation)
                    if (!newSourceUrl || !newSourceName)
                        throw new Error(
                            $_("settings.sources.errorAdd") +
                                " Name and URL are required.",
                        );
                    try {
                        new URL(newSourceUrl);
                    } catch (_) {
                        throw new Error(" Invalid URL format.");
                    }
                    newSourceData = {
                        name: newSourceName,
                        rss: { url: newSourceUrl },
                    };
                    break;
                case "rsshub":
                    // ... (keep existing rsshub validation and data creation)
                    if (!newSourceRsshubPath || !newSourceName)
                        throw new Error(
                            $_("settings.sources.errorAdd") +
                                " Name and RSSHub Path are required.",
                        );
                    if (newSourceRsshubPath.startsWith("/")) {
                        newSourceRsshubPath = newSourceRsshubPath.substring(1);
                    }
                    if (newSourceRsshubPath.includes(" ")) {
                        throw new Error(
                            $_("settings.sources.errorAdd") +
                                " RSSHub Path cannot contain spaces.",
                        );
                    }
                    newSourceData = {
                        name: newSourceName,
                        rss: { rsshub_route_path: newSourceRsshubPath },
                    };
                    break;
                default:
                    throw new Error(
                        $_("settings.sources.errorAdd") +
                            " Invalid add mode selected.",
                    );
            }

            // Check for duplicate names before adding
            const existingNames = (currentConfig.scrape?.sources || []).map(
                (s) => s.name.toLowerCase(),
            );
            if (existingNames.includes(newSourceData.name.toLowerCase())) {
                throw new Error(
                    `Source with name "${newSourceData.name}" already exists.`,
                );
            }

            const updatedSources = [
                ...(currentConfig.scrape?.sources || []),
                newSourceData,
            ];
            const updatedConfig: AppConfig = {
                ...currentConfig,
                scrape: {
                    ...(currentConfig.scrape || {}),
                    sources: updatedSources,
                },
            };

            console.log("Attempting to add source:", newSourceData);
            await applyConfigChanges(updatedConfig);
        } catch (e: any) {
            console.error("Failed to prepare or add source:", e);
            submitError = e.message || $_("settings.sources.errorAdd");
            isSubmitting = false;
        }
    }

    // --- OPML Import Logic ---
    async function handleOpmlFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
            resetOpmlPreview();
            return;
        }
        const file = input.files[0];
        opmlFile = input.files; // Keep file list reference if needed

        isParsingOpml = true;
        opmlParseError = null;
        showOpmlPreview = false;
        opmlPreviewSources = [];
        selectedOpmlSources.clear();

        try {
            console.log("Parsing OPML file:", file.name);
            const parsedSources = await parseOpml(file);
            if (parsedSources.length === 0) {
                throw new Error($_("settings.sources.opmlErrorNoFeeds"));
            }

            // Check for duplicates against *existing* sources
            const existingSourceNamesLower = (
                currentConfig?.scrape?.sources || []
            ).map((s) => s.name.toLowerCase());
            opmlPreviewSources = parsedSources.map((source, index) => ({
                ...source,
                ui_id: `opml-preview-${index}-${Date.now()}`,
                isDuplicate: existingSourceNamesLower.includes(
                    source.name.toLowerCase(),
                ),
            }));

            // Pre-select non-duplicates by default
            opmlPreviewSources.forEach((s) => {
                if (!s.isDuplicate && s.ui_id) {
                    selectedOpmlSources.add(s.ui_id);
                }
            });

            showOpmlPreview = true;
            console.log("OPML parsed, showing preview:", opmlPreviewSources);
        } catch (e: any) {
            console.error("Failed to parse OPML:", e);
            opmlParseError = e.message;
            resetOpmlPreview(); // Clear preview on error
        } finally {
            isParsingOpml = false;
        }
    }

    async function parseOpml(file: File): Promise<ScrapeSource[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, "text/xml");

                    const parseError = xmlDoc.querySelector("parsererror");
                    if (parseError) {
                        console.error(
                            "XML Parser Error:",
                            parseError.textContent,
                        );
                        throw new Error(
                            $_("settings.sources.opmlErrorParse", {
                                values: {
                                    detail:
                                        parseError.textContent?.split(
                                            "\n",
                                        )[0] || "Unknown XML error",
                                },
                            }),
                        );
                    }

                    const outlines = xmlDoc.querySelectorAll(
                        'outline[type="rss"][xmlUrl]',
                    );
                    const feeds: ScrapeSource[] = [];

                    outlines.forEach((outline) => {
                        const name =
                            outline.getAttribute("text") ||
                            outline.getAttribute("title") ||
                            "Untitled Feed";
                        const url = outline.getAttribute("xmlUrl");

                        if (name && url) {
                            try {
                                new URL(url); // Basic URL validation
                                feeds.push({
                                    name: name.trim(),
                                    rss: { url: url.trim() },
                                    // ui_id and isDuplicate added later
                                });
                            } catch (urlError) {
                                console.warn(
                                    `Skipping invalid URL in OPML: ${url} for feed ${name}`,
                                );
                            }
                        }
                    });
                    resolve(feeds);
                } catch (error: any) {
                    console.error("Error during OPML processing:", error);
                    reject(
                        new Error(
                            $_("settings.sources.opmlErrorParse", {
                                values: {
                                    detail: error.message,
                                },
                            }),
                        ),
                    );
                }
            };

            reader.onerror = (e) => {
                console.error("File reading error:", e);
                reject(
                    new Error(
                        $_("settings.sources.opmlErrorRead", {
                            values: {
                                detail:
                                    reader.error?.message ||
                                    "Unknown read error",
                            },
                        }),
                    ),
                );
            };

            reader.readAsText(file);
        });
    }

    function toggleSelectAllOpml(event: Event) {
        const isChecked = (event.target as HTMLInputElement).checked;
        selectedOpmlSources.clear(); // Clear first
        if (isChecked) {
            opmlPreviewSources.forEach((s) => {
                if (s.ui_id) selectedOpmlSources.add(s.ui_id);
            });
        }
        // Force reactivity by creating a new set (or trigger update differently if needed)
        selectedOpmlSources = new Set(selectedOpmlSources);
    }

    function handleOpmlCheckboxChange(ui_id: string, event: Event) {
        const isChecked = (event.target as HTMLInputElement).checked;
        if (isChecked) {
            selectedOpmlSources.add(ui_id);
        } else {
            selectedOpmlSources.delete(ui_id);
        }
        selectedOpmlSources = new Set(selectedOpmlSources); // Trigger reactivity
    }

    async function handleConfirmOpmlImport() {
        if (
            !currentConfig ||
            isImportingOpml ||
            selectedOpmlSources.size === 0
        ) {
            if (selectedOpmlSources.size === 0) {
                opmlParseError = "Please select at least one source to import."; // Add i18n later if needed
            }
            return;
        }

        console.log("Confirming OPML import for:", selectedOpmlSources);
        opmlParseError = null; // Clear previous errors

        const sourcesToAdd = opmlPreviewSources.filter(
            (s) => s.ui_id && selectedOpmlSources.has(s.ui_id),
        );

        // More robust duplicate check just before merging
        const existingSourceNamesLower = (
            currentConfig.scrape?.sources || []
        ).map((s) => s.name.toLowerCase());
        const finalSourcesToAdd = sourcesToAdd.filter((s) => {
            if (existingSourceNamesLower.includes(s.name.toLowerCase())) {
                console.warn(
                    `Skipping duplicate during final import confirmation: ${s.name}`,
                );
                return false; // Skip duplicates found against existing sources
            }
            return true;
        });

        // Check for duplicates within the selection itself (optional, but good practice)
        const namesInSelection = new Set<string>();
        const uniqueFinalSourcesToAdd = finalSourcesToAdd.filter((s) => {
            const lowerName = s.name.toLowerCase();
            if (namesInSelection.has(lowerName)) {
                console.warn(
                    `Skipping duplicate within OPML selection: ${s.name}`,
                );
                return false;
            }
            namesInSelection.add(lowerName);
            return true;
        });

        if (uniqueFinalSourcesToAdd.length === 0) {
            opmlParseError =
                "No new sources selected or all selected sources were duplicates."; // i18n later
            isImportingOpml = false;
            return;
        }

        const updatedSources = [
            ...(currentConfig.scrape?.sources || []),
            ...uniqueFinalSourcesToAdd, // Add only unique, non-duplicate ones
        ];

        const updatedConfig: AppConfig = {
            ...currentConfig,
            scrape: {
                ...(currentConfig.scrape || {}),
                sources: updatedSources,
            },
        };

        await applyConfigChanges(
            updatedConfig,
            $_("settings.sources.opmlImportSuccess", {
                values: {
                    count: uniqueFinalSourcesToAdd.length,
                },
            }),
        );
        // resetAddForm() called within applyConfigChanges on success
    }

    // --- Reset & Utility Functions ---
    function resetOpmlPreview() {
        showOpmlPreview = false;
        opmlPreviewSources = [];
        selectedOpmlSources.clear();
        opmlParseError = null;
        // Reset file input visually if possible/needed
        const fileInput = document.getElementById(
            "opml-file",
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        opmlFile = null;
    }

    function resetAddForm() {
        addMode = null;
        newSourceName = "";
        newSourceUrl = "";
        newSourceRsshubPath = "";
        opmlFile = null;
        submitError = null;
        isSubmitting = false;
        resetOpmlPreview(); // Also reset OPML state
        isImportingOpml = false;
    }

    function handleUrlBlur() {
        // ... (keep existing)
        if (addMode === "url" && newSourceUrl && !newSourceName) {
            try {
                const urlHost = new URL(newSourceUrl).hostname;
                newSourceName = urlHost.replace(/^www\./, "");
            } catch (_) {
                /* ignore */
            }
        }
    }
    function handleRsshubPathBlur() {
        // ... (keep existing)
        if (addMode === "rsshub" && newSourceRsshubPath && !newSourceName) {
            const pathPart = newSourceRsshubPath.split("/")[0];
            if (pathPart) {
                newSourceName = pathPart;
            }
        }
    }

    // --- Lifecycle ---
    onMount(() => {
        fetchSources();
    });

    // Reactive calculation for select all checkbox state
    $: allOpmlSelected =
        opmlPreviewSources.length > 0 &&
        selectedOpmlSources.size === opmlPreviewSources.length;
    $: someOpmlSelected =
        selectedOpmlSources.size > 0 &&
        selectedOpmlSources.size < opmlPreviewSources.length;
</script>

<div class="container mx-auto min-h-screen space-y-6 bg-base-200 p-4 md:p-8">
    <div
        class="card bg-base-100 border-base-300/50 rounded-xl border shadow-lg"
    >
        <div class="card-body p-4 md:p-6">
            {#if isLoading}
                <div class="flex h-40 items-center justify-center">
                    <span
                        class="loading loading-spinner loading-lg text-primary"
                    ></span>
                </div>
            {:else if error}
                <div role="alert" class="alert alert-error rounded-lg">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6 shrink-0 stroke-current"
                        fill="none"
                        viewBox="0 0 24 24"
                        ><path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        /></svg
                    >
                    <span class="font-semibold"
                        >{$_("settings.sources.errorLoadingPrefix")}</span
                    >
                    <span class="ml-1">{error}</span>
                </div>
            {:else if sources.length === 0}
                <p class="text-base-content/80 py-4 text-center">
                    {$_("settings.sources.emptyState")}
                </p>
            {:else}
                <div class="overflow-x-auto">
                    <table class="table table-zebra w-full">
                        <tbody>
                            {#each sources as source (source.ui_id)}
                                <tr class="hover">
                                    <td class="font-medium">{source.name}</td>
                                    <td class="max-w-xs break-all text-sm">
                                        {#if source.rss?.url}
                                            <span
                                                class="badge badge-primary badge-outline mr-1 whitespace-nowrap"
                                                >{$_(
                                                    "settings.sources.typeUrl",
                                                )}</span
                                            >
                                            {source.rss.url}
                                        {:else if source.rss?.rsshub_route_path}
                                            <span
                                                class="badge badge-secondary badge-outline mr-1 whitespace-nowrap"
                                                >{$_(
                                                    "settings.sources.typeRsshub",
                                                )}</span
                                            >
                                            {source.rss.rsshub_route_path}
                                        {:else}
                                            <span class="badge badge-ghost"
                                                >-</span
                                            >
                                        {/if}
                                    </td>
                                    <td class="text-right">
                                        <button
                                            class="btn btn-ghost btn-xs text-error"
                                            on:click={() =>
                                                deleteSource(source.ui_id)}
                                            title={$_(
                                                "settings.sources.deleteButtonTitle",
                                            )}
                                            disabled={isSubmitting ||
                                                isImportingOpml}
                                        >
                                            {#if isSubmitting}
                                                <span
                                                    class="loading loading-spinner loading-xs"
                                                ></span>
                                            {:else}
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke-width="1.5"
                                                    stroke="currentColor"
                                                    class="h-4 w-4"
                                                    ><path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                                                    /></svg
                                                >
                                            {/if}
                                        </button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
        </div>
    </div>

    <!-- Add New Source Section -->
    <div
        class="card bg-base-100 border-base-300/50 rounded-xl border shadow-lg"
    >
        <div class="card-body p-4 md:p-6">
            {#if !addMode}
                <!-- Initial Add Mode Selection -->
                <div class="flex flex-col gap-3">
                    <div class="flex gap-5">
                        <button
                            class="btn btn-outline btn-primary"
                            on:click={() => (addMode = "rsshub")}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="h-5 w-5 mr-1"
                                ><path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M12.75 19.5v-.75a7.5 7.5 0 0 0-7.5-7.5H4.5m0-6.75h.75c7.87 0 14.25 6.38 14.25 14.25v.75M6 18.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                                /></svg
                            >
                            {$_("settings.sources.addByRsshubButton")}
                        </button>
                        <span class="text-sm text-base-content/100 self-center"
                            >{$_("settings.sources.addByUrlDoc")}<a
                                href="https://docs.rsshub.app/routes/popular"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link link-secondary">RSSHub</a
                            ></span
                        >
                    </div>
                    <div class="flex gap-5">
                        <button
                            class="btn btn-outline btn-secondary"
                            on:click={() => (addMode = "url")}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="h-5 w-5 mr-1"
                                ><path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                                /></svg
                            >
                            {$_("settings.sources.addByUrlButton")}
                        </button>
                    </div>
                    <div class="flex gap-5">
                        <button
                            class="btn btn-outline btn-accent"
                            on:click={() => (addMode = "opml")}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="h-5 w-5 mr-1"
                                ><path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                                /></svg
                            >
                            {$_("settings.sources.addByOpmlButton")}
                        </button>
                        <span class="text-sm text-base-content/100 self-center"
                            >{$_("settings.sources.addByOpmlDoc")}<a
                                href="https://follow.is/"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link link-secondary">Follow</a
                            ></span
                        >
                    </div>
                </div>
            {:else if !showOpmlPreview}
                <!-- Add URL/RSSHub Form -->
                <form
                    on:submit|preventDefault={handleAddSource}
                    class="space-y-4"
                >
                    {#if addMode === "url"}
                        <div class="form-control">
                            <label class="label" for="source-name-url"
                                ><span class="label-text"
                                    >{$_(
                                        "settings.sources.labelSourceName",
                                    )}</span
                                ></label
                            >
                            <input
                                id="source-name-url"
                                type="text"
                                placeholder={$_(
                                    "settings.sources.placeholderSourceNameUrl",
                                )}
                                class="input input-bordered w-full"
                                bind:value={newSourceName}
                                required
                            />
                        </div>
                        <div class="form-control">
                            <label class="label" for="source-url"
                                ><span class="label-text"
                                    >{$_("settings.sources.labelFeedUrl")}</span
                                ></label
                            >
                            <input
                                id="source-url"
                                type="url"
                                placeholder={$_(
                                    "settings.sources.placeholderFeedUrl",
                                )}
                                class="input input-bordered w-full"
                                bind:value={newSourceUrl}
                                on:blur={handleUrlBlur}
                                required
                            />
                        </div>
                    {:else if addMode === "rsshub"}
                        <div class="form-control">
                            <label class="label" for="source-name-rsshub"
                                ><span class="label-text"
                                    >{$_(
                                        "settings.sources.labelSourceName",
                                    )}</span
                                ></label
                            >
                            <input
                                id="source-name-rsshub"
                                type="text"
                                placeholder={$_(
                                    "settings.sources.placeholderSourceNameRsshub",
                                )}
                                class="input input-bordered w-full"
                                bind:value={newSourceName}
                                required
                            />
                        </div>
                        <div class="form-control">
                            <label class="label" for="rsshub-path"
                                ><span class="label-text"
                                    >{$_(
                                        "settings.sources.labelRsshubPath",
                                    )}</span
                                ></label
                            >
                            <label
                                class="input input-bordered flex items-center gap-2"
                            >
                                /
                                <input
                                    id="rsshub-path"
                                    type="text"
                                    class="grow"
                                    placeholder={$_(
                                        "settings.sources.placeholderRsshubPath",
                                    )}
                                    bind:value={newSourceRsshubPath}
                                    on:blur={handleRsshubPathBlur}
                                    required
                                />
                            </label>
                            <div class="label">
                                <span class="label-text-alt"
                                    >{$_(
                                        "settings.sources.helpRsshubPath",
                                    )}</span
                                >
                            </div>
                        </div>
                    {:else if addMode === "opml"}
                        <!-- OPML File Input -->
                        <div class="form-control">
                            <input
                                id="opml-file"
                                type="file"
                                class="file-input file-input-bordered file-input-accent w-full"
                                accept=".opml,.xml"
                                bind:files={opmlFile}
                                on:change={handleOpmlFileChange}
                                required
                                disabled={isParsingOpml || isLoading}
                            />
                        </div>
                        {#if isParsingOpml}
                            <div class="flex items-center gap-2 text-accent">
                                <span class="loading loading-spinner loading-sm"
                                ></span>
                                {$_("settings.sources.opmlParsing")}
                            </div>
                        {/if}
                    {/if}

                    <!-- Submission Error Display (URL/RSSHub) -->
                    {#if submitError && addMode !== "opml"}
                        <div role="alert" class="alert alert-warning text-sm">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6 shrink-0 stroke-current"
                                fill="none"
                                viewBox="0 0 24 24"
                                ><path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                                /></svg
                            >
                            <span
                                >{$_("settings.sources.errorSubmitPrefix")}
                                {submitError}</span
                            >
                        </div>
                    {/if}
                    <!-- OPML Parsing Error Display -->
                    {#if opmlParseError && addMode === "opml"}
                        <div role="alert" class="alert alert-error text-sm">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6 shrink-0 stroke-current"
                                fill="none"
                                viewBox="0 0 24 24"
                                ><path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                /></svg
                            >
                            <span>{opmlParseError}</span>
                        </div>
                    {/if}

                    <!-- Action Buttons (URL/RSSHub/Initial OPML) -->
                    <div class="card-actions justify-end pt-2">
                        <button
                            type="button"
                            class="btn btn-ghost"
                            on:click={resetAddForm}
                            disabled={isSubmitting ||
                                isParsingOpml ||
                                isImportingOpml}
                        >
                            {$_("settings.sources.cancelButton")}
                        </button>
                        {#if addMode !== "opml"}
                            <button
                                type="submit"
                                class="btn btn-primary"
                                disabled={isSubmitting}
                            >
                                {#if isSubmitting}
                                    <span
                                        class="loading loading-spinner loading-sm mr-2"
                                    ></span>{$_(
                                        "settings.sources.savingButton",
                                    )}
                                {:else}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        class="h-5 w-5 mr-1"
                                        ><path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M12 4.5v15m7.5-7.5h-15"
                                        /></svg
                                    >{$_("settings.sources.saveSourceButton")}
                                {/if}
                            </button>
                        {/if}
                    </div>
                </form>
            {:else if showOpmlPreview}
                <!-- OPML Preview Section -->
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold text-neutral-content/90">
                        {$_("settings.sources.opmlPreviewTitle")}
                    </h3>

                    <!-- OPML Import Error Display -->
                    {#if opmlParseError}
                        <div role="alert" class="alert alert-error text-sm">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6 shrink-0 stroke-current"
                                fill="none"
                                viewBox="0 0 24 24"
                                ><path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                /></svg
                            >
                            <span>{opmlParseError}</span>
                        </div>
                    {/if}

                    <div
                        class="overflow-x-auto max-h-96 border border-base-300/50 rounded-lg"
                    >
                        <table
                            class="table table-sm table-pin-rows table-pin-cols w-full"
                        >
                            <thead>
                                <tr>
                                    <th class="w-10">
                                        <label>
                                            <input
                                                type="checkbox"
                                                class="checkbox checkbox-primary checkbox-xs"
                                                on:change={toggleSelectAllOpml}
                                                checked={allOpmlSelected}
                                                indeterminate={someOpmlSelected}
                                                title={allOpmlSelected
                                                    ? $_(
                                                          "settings.sources.opmlSelectNone",
                                                      )
                                                    : $_(
                                                          "settings.sources.opmlSelectAll",
                                                      )}
                                            />
                                        </label>
                                    </th>
                                    <th
                                        >{$_(
                                            "settings.sources.labelSourceName",
                                        )}</th
                                    >
                                    <th
                                        >{$_(
                                            "settings.sources.labelFeedUrl",
                                        )}</th
                                    >
                                </tr>
                            </thead>
                            <tbody>
                                {#each opmlPreviewSources as source (source.ui_id)}
                                    <tr
                                        class="hover"
                                        class:opacity-60={source.isDuplicate}
                                    >
                                        <td>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    class="checkbox checkbox-primary checkbox-xs"
                                                    checked={selectedOpmlSources.has(
                                                        source.ui_id ?? "",
                                                    )}
                                                    on:change={(e) =>
                                                        handleOpmlCheckboxChange(
                                                            source.ui_id ?? "",
                                                            e,
                                                        )}
                                                />
                                            </label>
                                        </td>
                                        <td class="font-medium break-words">
                                            {source.name}
                                            {#if source.isDuplicate}
                                                <span
                                                    class="badge badge-warning badge-xs ml-1 whitespace-nowrap"
                                                    title={$_(
                                                        "settings.sources.opmlDuplicateWarning",
                                                    )}>Duplicate</span
                                                >
                                            {/if}
                                        </td>
                                        <td class="text-xs break-all"
                                            >{source.rss?.url}</td
                                        >
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>

                    <div class="card-actions justify-between items-center pt-2">
                        <span class="text-sm text-base-content/70"
                            >{$_("settings.sources.opmlFeedsToImport", {
                                values: {
                                    count: selectedOpmlSources.size,
                                },
                            })}</span
                        >
                        <div class="flex gap-2">
                            <button
                                type="button"
                                class="btn btn-ghost"
                                on:click={resetAddForm}
                                disabled={isImportingOpml}
                            >
                                {$_("settings.sources.cancelButton")}
                            </button>
                            <button
                                type="button"
                                class="btn btn-primary"
                                on:click={handleConfirmOpmlImport}
                                disabled={isImportingOpml ||
                                    selectedOpmlSources.size === 0}
                            >
                                {#if isImportingOpml}
                                    <span
                                        class="loading loading-spinner loading-sm mr-2"
                                    ></span>{$_(
                                        "settings.sources.savingButton",
                                    )}
                                {:else}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        class="w-5 h-5 mr-1"
                                        ><path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M12 14.25 15 11.25M12 14.25v-9.75m-4.5 9.75v-6.75a2.25 2.25 0 0 1 2.25-2.25h3.75a2.25 2.25 0 0 1 2.25 2.25v6.75m-10.5 3.75a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V14.25M3.75 14.25h16.5"
                                        /></svg
                                    >
                                    {$_("settings.sources.opmlConfirmImport")}
                                {/if}
                            </button>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>

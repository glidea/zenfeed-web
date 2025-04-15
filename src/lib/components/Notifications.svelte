<script context="module" lang="ts">
    import { apiUrl } from "$lib/stores/apiUrl";
    import { get } from "svelte/store";

    interface EmailChannel {
        smtp_endpoint?: string;
        from?: string;
        password?: string;
        feed_html_snippet_template?: string;
    }

    interface NotifyChannels {
        email?: EmailChannel;
    }

    let managedReceiverName = "zendfeed-web-managed";
    interface NotifyReceiver {
        name: string;
        email?: string;
    }

    interface NotifyRoute {
        receivers?: string[];
    }

    export interface NotifyConfig {
        route?: NotifyRoute;
        receivers?: NotifyReceiver[];
        channels?: NotifyChannels;
    }

    let managedRuleName = "zendfeed-web-managed-daily";
    interface ScheduleRule {
        name: string;
        query?: string;
        every_day?: string;
    }

    export interface SchedulsConfig {
        rules?: ScheduleRule[];
    }

    export interface App {
        scheduls?: SchedulsConfig;
        notify?: NotifyConfig;
    }
</script>

<script lang="ts">
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";

    // --- State ---
    let appConfigPatched: App | null = null;
    let appConfigJSON: string | null = null;
    let isLoading = true;
    let error: string | null = null;
    let saveStatus: "idle" | "saving" | "success" | "error" = "idle";
    let saveError: string | null = null;

    // Form state derived from appConfig
    let emailSmtpEndpoint = "";
    let emailFrom = "";
    let emailPassword = "";
    let dailySendTime = "17:30";
    let trackedEvents: { name: string; query: string }[] = [];

    // --- API Interaction ---
    async function fetchConfig() {
        isLoading = true;
        error = null;
        saveStatus = "idle";
        try {
            const baseUrl = get(apiUrl);
            const response = await fetch(`${baseUrl}/query_config`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            appConfigPatched = await response.json();
            // Store the fetched config as the base JSON string
            appConfigJSON = JSON.stringify(appConfigPatched);
            updateFormState(); // Populate form based on fetched config
        } catch (e: any) {
            console.error("Error fetching config:", e);
        } finally {
            isLoading = false;
        }
    }

    async function saveSettings() {
        // Use appConfigJSON as the base, ensure it's not null
        if (!appConfigJSON) {
            return;
        }
        saveStatus = "saving";
        saveError = null;

        let configToSend: any; // Use 'any' since we don't assume full App structure
        try {
            // 1. Parse the original config JSON into a generic object
            configToSend = JSON.parse(appConfigJSON);
        } catch (e: any) {
            saveStatus = "error";
            saveError = `${e.message}`;
            console.error("Error parsing appConfigJSON:", e);
            return;
        }

        try {
            // 2. Apply changes from form state onto the generic configToSend object
            // Ensure nested structures exist before modification
            configToSend.notify = configToSend.notify ?? {};
            configToSend.notify.channels = configToSend.notify.channels ?? {};
            configToSend.notify.channels.email =
                configToSend.notify.channels.email ?? {};
            configToSend.scheduls = configToSend.scheduls ?? {};
            configToSend.scheduls.rules = configToSend.scheduls.rules ?? [];

            // 2.1 Update Email Config using form values
            configToSend.notify.channels.email.smtp_endpoint =
                emailSmtpEndpoint || undefined; // Set to undefined if empty to potentially remove
            configToSend.notify.channels.email.from = emailFrom || undefined;
            configToSend.notify.channels.email.password =
                emailPassword || undefined;

            const managedReceiverIndex =
                configToSend.notify.receivers.findIndex(
                    (receiver: NotifyReceiver) =>
                        receiver.name === managedReceiverName,
                );
            if (managedReceiverIndex !== -1) {
                configToSend.notify.receivers[managedReceiverIndex].email =
                    emailFrom || undefined;
            } else {
                configToSend.notify.receivers.push({
                    name: managedReceiverName,
                    email: emailFrom || undefined,
                });
            }

            configToSend.notify.route = configToSend.notify.route ?? {};
            configToSend.notify.route.receivers =
                configToSend.notify.route.receivers ?? [];
            if (
                !configToSend.notify.route.receivers.includes(
                    managedReceiverName,
                )
            ) {
                configToSend.notify.route.receivers.push(managedReceiverName);
            }

            // 2.2 Update the specific managed daily schedule rule
            const dailyTimeFormatted = dailySendTime
                ? `-${dailySendTime}~${dailySendTime}`
                : undefined;
            const managedRuleIndex = configToSend.scheduls.rules.findIndex(
                (rule: ScheduleRule) => rule.name === managedRuleName,
            );

            if (dailyTimeFormatted) {
                if (managedRuleIndex !== -1) {
                    // Update existing managed rule
                    configToSend.scheduls.rules[managedRuleIndex].every_day =
                        dailyTimeFormatted;
                    // Ensure other conflicting schedule types are removed
                    delete configToSend.scheduls.rules[managedRuleIndex].query;
                } else {
                    // Add new managed rule if it doesn't exist
                    configToSend.scheduls.rules.push({
                        name: managedRuleName,
                        every_day: dailyTimeFormatted,
                    });
                }
            } else {
                // If dailySendTime is cleared/invalid, remove the managed rule if it exists
                if (managedRuleIndex !== -1) {
                    configToSend.scheduls.rules.splice(managedRuleIndex, 1);
                }
            }

            // 2.3 Update Tracked Events (Query Rules) based on form state
            const currentTrackedEventNames = new Set(
                trackedEvents.map((e) => e.name),
            );

            // Filter rules: keep non-query rules, keep the managed rule, and keep query rules present in the current form state.
            // Create a new array for the updated rules
            const updatedRules: ScheduleRule[] = [];
            for (const rule of configToSend.scheduls.rules) {
                if (rule.name === managedRuleName) {
                    // Ensure the managed rule (potentially updated/added above) is kept
                    if (dailyTimeFormatted) {
                        // Only keep if daily time is set
                        updatedRules.push(rule);
                    }
                    continue; // Move to next rule
                }
                if (!rule.query) {
                    // Keep other non-query rules
                    updatedRules.push(rule);
                    continue;
                }
                if (currentTrackedEventNames.has(rule.name)) {
                    // Keep query rules present in the form
                    updatedRules.push(rule);
                }
                // Implicitly drops query rules not in currentTrackedEventNames
            }
            configToSend.scheduls.rules = updatedRules;

            // Add or update tracked event rules from the form state into configToSend.scheduls.rules
            for (const event of trackedEvents) {
                const existingRuleIndex = configToSend.scheduls.rules.findIndex(
                    (rule: ScheduleRule) => rule.name === event.name,
                );

                if (existingRuleIndex !== -1) {
                    // Update existing rule (ensure it's treated as a query rule)
                    const existingRule =
                        configToSend.scheduls.rules[existingRuleIndex];
                    // Only update if it's not the managed rule (safety check)
                    if (existingRule.name !== managedRuleName) {
                        existingRule.query = event.query || ""; // Use empty string if query is cleared
                        delete existingRule.every_day; // Remove conflicting schedule type
                    }
                } else {
                    // Add new tracked event rule if it's not the managed rule name
                    if (event.name !== managedRuleName) {
                        configToSend.scheduls.rules.push({
                            name: event.query, // Use query as name
                            query: event.query || "",
                        });
                    }
                }
            }

            // 3. Serialize the modified object back to JSON
            const updatedConfigJSON = JSON.stringify(configToSend, null, 2); // Pretty print for potential debugging

            // 4. Send the merged config to API
            const baseUrl = get(apiUrl);
            const response = await fetch(`${baseUrl}/apply_config`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: updatedConfigJSON, // Send the modified JSON string
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(
                    `HTTP error! status: ${response.status}, body: ${errorBody}`,
                );
            }

            // 5. Update local state on success
            saveStatus = "success";
            // Update the base JSON string first
            appConfigJSON = updatedConfigJSON;
            // Then update the 'patched' state by re-parsing the successful JSON
            // This ensures appConfigPatched reflects exactly what was saved,
            // even if the original JSON had extra fields.
            try {
                appConfigPatched = JSON.parse(appConfigJSON) as App;
            } catch (e) {
                // Should not happen if updatedConfigJSON is valid, but handle defensively
                console.error(
                    "Failed to parse the saved config back into App structure:",
                    e,
                );
                // Attempt to reload from server as a fallback?
                // For now, just log the error. The appConfigJSON is updated anyway.
            }

            setTimeout(() => (saveStatus = "idle"), 3000);
        } catch (e: any) {
            saveStatus = "error";
            saveError = `${e.message}`;
            console.error("Error saving config:", e);
            // Do not update appConfigPatched or appConfigJSON on error
        }
    }

    // --- Helper Functions ---
    function updateFormState() {
        if (!appConfigPatched) return;

        // Email
        emailSmtpEndpoint =
            appConfigPatched.notify?.channels?.email?.smtp_endpoint ?? "";
        emailFrom = appConfigPatched.notify?.channels?.email?.from ?? "";
        emailPassword =
            appConfigPatched.notify?.channels?.email?.password ?? "";

        // Daily Send Time - Find the specific managed rule by name
        const dailyRule = appConfigPatched.scheduls?.rules?.find(
            (rule) => rule.name === managedRuleName,
        );

        if (dailyRule?.every_day) {
            const parts = dailyRule.every_day.split("~");
            if (
                parts.length === 2 &&
                parts[1] &&
                /^\d{2}:\d{2}$/.test(parts[1])
            ) {
                dailySendTime = parts[1];
            } else {
                console.warn(
                    `Unexpected every_day format for rule '${managedRuleName}': ${dailyRule.every_day}`,
                );
                dailySendTime = "17:30";
            }
        } else {
            dailySendTime = "17:30";
        }

        // Tracked Events (Query Rules) - Filter out the managed rule specifically
        trackedEvents =
            appConfigPatched.scheduls?.rules
                ?.filter(
                    (rule) =>
                        rule.name !== managedRuleName && rule.query != null,
                )
                .map((rule) => ({
                    name: rule.name ?? "",
                    query: rule.query ?? "",
                })) ?? [];
    }

    function addTrackedEvent() {
        trackedEvents = [...trackedEvents, { name: "", query: "" }];
    }

    function removeTrackedEvent(index: number) {
        trackedEvents = trackedEvents.filter((_, i) => i !== index);
    }

    onMount(() => {
        fetchConfig();
    });
</script>

{#if isLoading}
    <div class="flex items-center justify-center p-8">
        <span class="loading loading-spinner loading-lg mr-2"></span>{$_(
            "notifications.loading",
        )}
    </div>
{:else if error}
    <div role="alert" class="alert alert-error">
        <div>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 flex-shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
                ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                /></svg
            >
            <span>{error}</span>
            {#if !isLoading}
                <button class="btn btn-sm btn-ghost" on:click={fetchConfig}
                    >{$_("notifications.retryButton")}</button
                >
            {/if}
        </div>
    </div>
{:else if appConfigPatched}
    <div class="space-y-6 p-4">
        <form on:submit|preventDefault={saveSettings} class="space-y-6">
            <!-- Email Config -->
            <fieldset class="fieldset space-y-3">
                <legend class="fieldset-legend"
                    >{$_("notifications.emailLegend")}</legend
                >
                <div class="form-control">
                    <label class="label" for="smtpEndpoint">
                        <span class="label-text"
                            >{$_("notifications.smtpLabel")}</span
                        >
                    </label>
                    <input
                        type="text"
                        id="smtpEndpoint"
                        placeholder={$_("notifications.smtpPlaceholder")}
                        class="input input-bordered w-full"
                        bind:value={emailSmtpEndpoint}
                    />
                </div>
                <div class="form-control">
                    <label class="label" for="emailFrom">
                        <span class="label-text"
                            >{$_("notifications.emailLabel")}</span
                        >
                    </label>
                    <input
                        type="email"
                        id="emailFrom"
                        placeholder={$_("notifications.emailPlaceholder")}
                        class="input input-bordered w-full"
                        bind:value={emailFrom}
                    />
                </div>
                <div class="form-control">
                    <label class="label" for="emailPassword">
                        <span class="label-text"
                            >{$_("notifications.passwordLabel")}
                            <a
                                href="https://support.google.com/accounts/answer/185833"
                                target="_blank"
                                rel="noopener noreferrer"
                                >{$_("notifications.passwordLabelLink")}</a
                            ></span
                        >
                    </label>
                    <input
                        type="password"
                        id="emailPassword"
                        class="input input-bordered w-full"
                        bind:value={emailPassword}
                    />
                </div>
            </fieldset>

            <!-- Schedule Rules -->
            <fieldset class="fieldset space-y-3">
                <legend class="fieldset-legend"
                    >{$_("notifications.scheduleLegend")}</legend
                >
                <div class="form-control">
                    <label class="label" for="dailySendTime">
                        <span class="label-text"
                            >{$_("notifications.dailyTimeLabel")}</span
                        >
                    </label>
                    <input
                        type="time"
                        id="dailySendTime"
                        class="input input-bordered w-24 max-w-xs"
                        bind:value={dailySendTime}
                        required
                    />
                </div>
            </fieldset>

            <!-- Tracked Events (Query Rules) -->
            <fieldset class="fieldset space-y-3">
                <legend class="fieldset-legend"
                    >{$_("notifications.trackedEventsLegend")}</legend
                >
                {#each trackedEvents as event, index (index)}
                    <!-- Use card for better visual grouping -->
                    <div
                        class="card card-bordered card-compact bg-base-200 p-3 relative"
                    >
                        <button
                            type="button"
                            class="btn btn-xs btn-circle btn-ghost absolute top-1 right-1"
                            on:click={() => removeTrackedEvent(index)}
                            aria-label={$_(
                                "notifications.removeEventButtonLabel",
                            )}
                            disabled={saveStatus === "saving"}
                        >
                            ✕
                        </button>
                        <div class="form-control">
                            <textarea
                                id={`eventQuery-${index}`}
                                placeholder={$_(
                                    "notifications.queryPlaceholder",
                                )}
                                class="textarea textarea-base textarea-bordered w-full p-3 h-12"
                                rows="2"
                                bind:value={event.query}
                                required
                                disabled={saveStatus === "saving"}
                            >
                            </textarea>
                        </div>
                    </div>
                {:else}
                    <p class="text-sm text-gray-500">
                        {$_("notifications.noTrackedEvents")}
                        {$_("notifications.addEventHint")}
                    </p>
                {/each}
                <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    on:click={addTrackedEvent}
                    disabled={saveStatus === "saving"}
                >
                    {$_("notifications.addEventButton")}
                </button>
            </fieldset>

            <div class="flex items-center space-x-4 pt-4">
                <button
                    type="submit"
                    class="btn btn-primary"
                    disabled={saveStatus === "saving"}
                >
                    {#if saveStatus === "saving"}
                        <span class="loading loading-spinner loading-xs mr-2"
                        ></span>
                        {$_("notifications.savingButton")}
                    {:else}
                        {$_("notifications.saveButton")}
                    {/if}
                </button>
                {#if saveStatus === "success"}
                    <span class="text-success text-sm"
                        >{$_("notifications.saveSuccess")}</span
                    >
                {:else if saveStatus === "error"}
                    <span class="text-error text-sm"
                        >{saveError ||
                            $_("notifications.saveErrorDefault")}</span
                    >
                {/if}
            </div>
        </form>
    </div>
{/if}

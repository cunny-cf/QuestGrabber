/** Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";
import { Settings } from "@api/Settings";

let cachedScript: string | null = null;


// \n\n\nAs of April 7th 2026, Discord has expressed their intent to crack down on automating quest completion.\nThere isn't much I can do to make the script undetected, so use it at your own risk, as you most likely WILL get flagged by doing so.\n\nThis does not works in browser for quests which require you to play a game! Use the desktop app to complete those.
const cfg = definePluginSettings({
    runScript: {
        type: OptionType.BOOLEAN,
        description: "This toggle will visually stay on, refreshing or reopening settings will reset it. Only use this to run the script once after accepting a Quest.",
        default: false,
        onChange: async (enabled: boolean) => {
            if (!enabled) return;

            const MAX_RETRIES = 10;
            let attempt = 0;
            let scriptToRun = cachedScript;

            // Try to fetch if not cached
            while (!scriptToRun && attempt < MAX_RETRIES) {
                attempt++;
                try {
                    const url = "https://api.github.com/gists/204cd9d42013ded9faf646fae7f89fbb";

                    showToast(`Fetching quest script... (Attempt ${attempt}/${MAX_RETRIES})`, {
                        type: Toasts.Type.MESSAGE,
                        timeout: 5000
                    });
                    console.log(`[QuestGrabber] Fetch attempt ${attempt}/${MAX_RETRIES}...`);

                    const jsCode = await fetchJsCodeblock(url);
                    if (jsCode) {
                        cachedScript = jsCode;
                        scriptToRun = jsCode;
                        console.log(`[QuestGrabber] Script cached successfully! (${jsCode.length} chars)`);
                        break;
                    }
                } catch (err: any) {
                    console.error(`[QuestGrabber] Attempt ${attempt} failed:`, err);
                }

                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                }
            }

            if (!scriptToRun) {
                showToast("Failed to fetch script after multiple attempts.", { type: Toasts.Type.FAILURE });
                resetToggle();
                return;
            }

            // Run the script
            let originalLog: any, originalError: any, originalWarn: any;

            try {
                console.log("[QuestGrabber] Running cached script...");

                originalLog = console.log;
                originalError = console.error;
                originalWarn = console.warn;

                const keywords = ["quest", "Quest", "quests", "Spoofed"];

                const enhancedLog = (...args: any[]) => {
                    originalLog(...args);

                    try {
                        const message = args.map(a => String(a)).join(" ").trim();
                        if (!message) return;

                        if (keywords.some(kw => message.includes(kw))) {
                            showToast(message, {
                                type: Toasts.Type.MESSAGE,
                                timeout: 10000
                            });
                        }
                    } catch (e) {
                        originalLog("[Toast Error]", ...args);
                    }
                };

                console.log = enhancedLog;
                console.error = enhancedLog;
                console.warn = enhancedLog;

                // eslint-disable-next-line no-eval
                eval(scriptToRun);

                // showToast("Quest script executed successfully!", { type: Toasts.Type.SUCCESS });

            } catch (err) {
                console.error("[QuestGrabber] Execution error:", err);
                showToast("Script execution failed - check console", { type: Toasts.Type.FAILURE });
            } finally {
                if (originalLog) console.log = originalLog;
                if (originalError) console.error = originalError;
                if (originalWarn) console.warn = originalWarn;
            }

            resetToggle();
        },
    },
    warningCaution: {
        type: OptionType.BOOLEAN,
        description: "As of April 7th 2026, Discord has expressed their intent to crack down on automating quest completion.  There isn't much I can do to make the script undetected, so use it at your own risk, as you most likely WILL get flagged by doing so.  This does not works in browser for quests which require you to play a game! Use the desktop app to complete those.",
        default: false,
        onChange: async (enabled: boolean) => {
            if (!enabled) return;
            showToast("⚠️ Caution: Using this plugin may lead to account flags or bans. Use at your own risk! ⚠️", {
                type: Toasts.Type.WARNING,
                timeout: 10000
            });
            resetToggle();
        },
    }
});

export default definePlugin({
    name: "QuestGrabber",
    description: "Grabs and runs aaimia's CompleteDiscordQuest script for Orbs. \n(https://gist.github.com/aamiaa/204cd9d42013ded9faf646fae7f89fbb)",
    authors: [{ name: "Hina", id: 444684887363026974n }],
    settings: cfg,
    cachedScript: null as string | null,

    addRunButton() {
        document.getElementById("questgrabber-run-btn")?.remove();

        const observer = new MutationObserver(() => {
            // More specific selector: Look for the stack that contains "Explore Orbs Exclusives" or "Discord Orbs Terms"
            const exploreButton = Array.from(document.querySelectorAll("button"))
                .find(btn => btn.textContent?.includes("Explore Orbs Exclusives"));

            if (!exploreButton) return;

            const stack = exploreButton.closest('.stack_dbd263');
            if (!stack || document.getElementById("questgrabber-run-btn")) return;

            const runButton = document.createElement("button");
            runButton.id = "questgrabber-run-btn";
            runButton.textContent = "Complete Quest!";
            runButton.style.cssText = `
            margin: 0;
            padding: 10px 16px;
            background-color: #FFD700;
            color: black;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
        `;

            runButton.onmouseover = () => runButton.style.backgroundColor = "#af9500ff";
            runButton.onmouseout = () => runButton.style.backgroundColor = "#FFD700";

            runButton.onclick = () => {
                const settings = Vencord.Settings.plugins.QuestGrabber;
                if (settings) {
                    settings.runScript = true;
                    Vencord.Settings.forceUpdate?.();
                }
            };

            stack.appendChild(runButton);
            console.log("[QuestGrabber] ✅ Run button successfully added next to Orbs buttons");
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.observer = observer;
    },

    start() {
        console.log("[QuestGrabber] Plugin loaded successfully");
        this.addRunButton();
    },

    stop() {
        console.log("[QuestGrabber] Plugin stopped");
        this.observer?.disconnect();
        document.getElementById("questgrabber-run-btn")?.remove();
    },
});

async function fetchJsCodeblock(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, {
            headers: {
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const files = data.files;

        const content = Object.values(files)[0].content;

        const regexes = [
            /```js\s*([\s\S]*?)\s*```/i,
            /```javascript\s*([\s\S]*?)\s*```/i,
            /```(?:js|javascript)\s*([\s\S]*?)\s*```/i
        ];

        for (const regex of regexes) {
            const match = content.match(regex);
            if (match?.[1]) {
                return match[1].trim();
            }
        }

        return null;
    } catch (err) {
        console.error("[QuestGrabber] Fetch error:", err);
        return null;
    }
}

function resetToggle() {
    setTimeout(() => {
        try {
            const settings = Vencord.Settings.plugins.QuestGrabber;
            if (settings) settings.runScript = false;
            Vencord.Settings.forceUpdate?.();
        } catch (e) {
            console.error("[QuestGrabber] Failed to reset toggle:", e);
        }
    }, 400);
}
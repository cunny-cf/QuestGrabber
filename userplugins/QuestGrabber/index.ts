/** Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

let cachedScript: string | null = null;
let cachedRemoteVersion: string | null = null;   // ← Version cache
const CURRENT_VERSION = "1.2.2";


// GitHub repo info
const GITHUB_REPO = "cunny-cf/QuestGrabber";
const FILE_PATH = "userplugins/QuestGrabber/index.ts";   // Change if your file path changes

const cfg = definePluginSettings({
    runScript: {
        type: OptionType.BOOLEAN,
        description: "This toggle will visually stay on, refreshing or reopening settings will reset it. Only use this to run the script once after accepting a Quest.",
        default: false,
        onChange: async (enabled: boolean) => {
            if (!enabled) return;

            // === Version Check ===
            await checkForUpdate();

            const MAX_RETRIES = 10;
            let attempt = 0;
            let scriptToRun = cachedScript;

            // Try to fetch if not cached - PARALLEL VERSION
            if (!scriptToRun) {
                const promises: Promise<string | null>[] = [];

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    promises.push(
                        (async () => {
                            try {
                                // showToast(`Fetching quest script... (Attempt ${attempt}/${MAX_RETRIES})`);
                                console.log(`[QuestGrabber] Fetch attempt ${attempt}/${MAX_RETRIES}...`);

                                const jsCode = await fetchJsCodeblock(
                                    "https://api.github.com/gists/204cd9d42013ded9faf646fae7f89fbb"
                                );

                                if (jsCode) {
                                    cachedScript = jsCode;
                                    scriptToRun = jsCode;
                                    // showToast("Script fetched and cached successfully!");
                                    console.log(`[QuestGrabber] Script cached successfully! (${jsCode.length} chars)`);
                                    return jsCode;
                                }
                                return null;
                            } catch (err: any) {
                                console.error(`[QuestGrabber] Attempt ${attempt} failed:`, err);
                                return null;
                            }
                        })()
                    );
                }

                const results = await Promise.all(promises);
                scriptToRun = results.find(code => code !== null) || null;
            }

            if (!scriptToRun) {
                showToast("Failed to fetch script after multiple attempts.");
                resetToggle();
                return;
            } else {
                showToast("Script fetched successfully! Running now...");
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
                            showToast(message);
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

            } catch (err) {
                console.error("[QuestGrabber] Execution error:", err);
                showToast("Script execution failed - check console");
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
        description: "As of April 7th 2026, Discord has expressed their intent to crack down on automating quest completion. ...",
        default: false,
        onChange: async (enabled: boolean) => {
            if (!enabled) return;
            showToast("⚠️ Caution: Using this plugin may lead to account flags or bans. Use at your own risk! ⚠️");
            resetToggle();
        },
    }
});

export default definePlugin({
    name: "QuestGrabber",
    description: "Grabs and runs aaimia's CompleteDiscordQuest script for Orbs. \n(https://gist.github.com/aamiaa/204cd9d42013ded9faf646fae7f89fbb)",
    authors: [{ name: "Nemu-tan", id: 651263919163179029n }],
    version: CURRENT_VERSION,           // ← Added
    settings: cfg,

    addRunButton() {
        document.getElementById("questgrabber-run-btn")?.remove();

        const buttonTexts = [
            "Explore Orbs Exclusives",
            "View Quest",
            "Play Now",
            "Watch Now"
        ];

        const Find_Button = "View Quest";   // Change this if needed

        const observer = new MutationObserver(() => {
            // Use the same selector that works in HTML version
            const heroContainer = Array.from(document.querySelectorAll('[class*="contentBody"]'))
                .find(el => {
                    return buttonTexts.some(text => el.textContent?.includes(text));
                });

            if (!heroContainer) return;

            // Find the button inside the container
            const exploreButton = Array.from(heroContainer.querySelectorAll("button"))
                .find(btn => {
                    const text = btn.textContent?.trim();
                    if (!text) return false;
                    return buttonTexts.some(variant => text.includes(variant)) ||
                        text.includes(Find_Button);
                });

            if (!exploreButton) return;

            // Prevent duplicates
            if (document.getElementById("questgrabber-run-btn")) return;

            const stack = exploreButton.closest('.stack_dbd263') || exploreButton.parentElement;

            if (!stack) return;

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
        console.log(`[QuestGrabber] Plugin loaded successfully (v${CURRENT_VERSION})`);

        // Small delay helps with timing issues
        setTimeout(() => {
            this.addRunButton();
        }, 1500);
    },

    stop() {
        console.log("[QuestGrabber] Plugin stopped");
        this.observer?.disconnect();
        document.getElementById("questgrabber-run-btn")?.remove();
    },
});

async function checkForUpdate() {
    // If we already have a cached remote version, just compare
    if (cachedRemoteVersion) {
        if (compareVersions(cachedRemoteVersion, CURRENT_VERSION) > 0) {
            showToast(`New version found: ${cachedRemoteVersion} (you have ${CURRENT_VERSION})`);
        } else {
            showToast(`You are on the latest version ${CURRENT_VERSION}`);
        }
        return;
    }

    // First time check
    const MAX_RETRIES = 10;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        attempt++;
        try {
            console.log(`[QuestGrabber] Checking for updates... (Attempt ${attempt}/${MAX_RETRIES})`);

            const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;

            const response = await fetch(url, {
                headers: {
                    "Accept": "application/vnd.github.v3+json"
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            let content = data.content;
            if (data.encoding === "base64") {
                content = atob(content.replace(/\n/g, ''));
            }

            const versionMatch = content.match(/CURRENT_VERSION\s*=\s*["']([\d.]+)["']/);
            if (!versionMatch || !versionMatch[1]) {
                console.log("[QuestGrabber] Could not parse version.");
                return;
            }

            cachedRemoteVersion = versionMatch[1];

            if (compareVersions(cachedRemoteVersion, CURRENT_VERSION) > 0) {
                showToast(`New version found: ${cachedRemoteVersion} (you have ${CURRENT_VERSION})`, { timeout: 10000 });
                console.log(`[QuestGrabber] Update available! ${CURRENT_VERSION} → ${cachedRemoteVersion}`);
            } else {
                showToast(`You are on the latest version ${CURRENT_VERSION}`);
                console.log(`[QuestGrabber] You are on the latest version (v${CURRENT_VERSION})`);
            }
            return;

        } catch (err: any) {
            console.error(`[QuestGrabber] Update check attempt ${attempt} failed:`, err.message || err);

            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 1100 * attempt));
            }
        }
    }

    console.warn("[QuestGrabber] Version check failed after all attempts.");
}

function compareVersions(a: string, b: string): number {
    const arrA = a.split('.').map(Number);
    const arrB = b.split('.').map(Number);
    for (let i = 0; i < Math.max(arrA.length, arrB.length); i++) {
        const diff = (arrA[i] || 0) - (arrB[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

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

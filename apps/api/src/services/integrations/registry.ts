// ============================================================
// Provider Registry
// Central lookup of all registered integration providers.
// Adding a new provider: implement IntegrationProvider, import
// it here, and add one line to the `providers` map.
// ============================================================

import type { IntegrationProvider, ProviderName } from "./types.js";
import { StravaProvider } from "./providers/strava.js";
import { GarminProvider } from "./providers/garmin.js";
import { PolarProvider } from "./providers/polar.js";
import { WahooProvider } from "./providers/wahoo.js";

const providers = new Map<ProviderName, IntegrationProvider>([
    ["STRAVA", new StravaProvider()],
    ["GARMIN", new GarminProvider()],
    ["POLAR", new PolarProvider()],
    ["WAHOO", new WahooProvider()],
]);

/** Get a specific provider by name. Throws if unknown. */
export function getProvider(name: ProviderName): IntegrationProvider {
    const p = providers.get(name);
    if (!p) throw new Error(`Unknown integration provider: ${name}`);
    return p;
}

/** Get all registered providers (for Settings page listing). */
export function getAllProviders(): IntegrationProvider[] {
    return [...providers.values()];
}

/** Get all registered provider names. */
export function getAllProviderNames(): ProviderName[] {
    return [...providers.keys()];
}

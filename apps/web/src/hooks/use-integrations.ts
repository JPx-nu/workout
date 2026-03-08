"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { getApiConfigurationError, getApiUrl } from "@/lib/constants";

export interface IntegrationActionPaths {
	connect: string | null;
	disconnect: string | null;
	sync: string | null;
}

export interface IntegrationStatus {
	provider: string;
	connected: boolean;
	lastSyncAt: string | null;
	providerUid: string | null;
	available: boolean;
	availabilityReason: string | null;
	applyUrl: string | null;
	actions: IntegrationActionPaths;
}

export interface IntegrationStatusSnapshot {
	integrations: IntegrationStatus[];
	webhookQueueSize: number;
}

const EMPTY_SNAPSHOT: IntegrationStatusSnapshot = {
	integrations: [],
	webhookQueueSize: 0,
};

function buildAbsoluteUrl(pathOrUrl: string): string {
	if (/^https?:\/\//.test(pathOrUrl)) {
		return pathOrUrl;
	}

	return getApiUrl(pathOrUrl);
}

export function useIntegrations() {
	const { session } = useAuth();
	const [snapshot, setSnapshot] = useState<IntegrationStatusSnapshot>(EMPTY_SNAPSHOT);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const request = useCallback(
		async (path: string, init?: RequestInit) => {
			if (!session?.access_token) {
				throw new Error("Not authenticated");
			}

			const configError = getApiConfigurationError();
			if (configError) {
				throw new Error(configError);
			}

			const response = await fetch(buildAbsoluteUrl(path), {
				...init,
				headers: {
					Authorization: `Bearer ${session.access_token}`,
					"Content-Type": "application/json",
					...(init?.headers ?? {}),
				},
			});

			if (!response.ok) {
				let message = "Request failed.";
				try {
					const data = (await response.json()) as {
						detail?: string;
						title?: string;
						error?: string;
					};
					message = data.detail ?? data.title ?? data.error ?? message;
				} catch {
					// Ignore parse errors and keep fallback message.
				}
				throw new Error(message);
			}

			return response;
		},
		[session?.access_token],
	);

	const fetchSnapshot = useCallback(async () => {
		if (!session?.access_token) {
			setSnapshot(EMPTY_SNAPSHOT);
			setError(null);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const response = await request("/api/integrations/status");
			const data = (await response.json()) as IntegrationStatusSnapshot;
			setSnapshot(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load integrations.");
			setSnapshot(EMPTY_SNAPSHOT);
		} finally {
			setIsLoading(false);
		}
	}, [request, session?.access_token]);

	useEffect(() => {
		void fetchSnapshot();
	}, [fetchSnapshot]);

	const syncIntegration = useCallback(
		async (integration: IntegrationStatus) => {
			if (!integration.actions.sync) return;
			await request(integration.actions.sync, { method: "POST" });
			await fetchSnapshot();
		},
		[fetchSnapshot, request],
	);

	const disconnectIntegration = useCallback(
		async (integration: IntegrationStatus) => {
			if (!integration.actions.disconnect) return;
			await request(integration.actions.disconnect, { method: "POST" });
			await fetchSnapshot();
		},
		[fetchSnapshot, request],
	);

	const getConnectUrl = useCallback((integration: IntegrationStatus) => {
		const target = integration.available ? integration.actions.connect : integration.applyUrl;
		return target ? buildAbsoluteUrl(target) : null;
	}, []);

	return {
		snapshot,
		isLoading,
		error,
		refetch: fetchSnapshot,
		syncIntegration,
		disconnectIntegration,
		getConnectUrl,
	};
}

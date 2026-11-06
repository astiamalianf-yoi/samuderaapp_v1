"use client";

import type { AlertFeedItem } from "./types";
import { transformAlert } from "./alert-utils";

const SSE_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export function connectSSE(onAlert: (data: AlertFeedItem) => void): () => void {
	const url = `${SSE_BASE}/sse`;
	const es = new EventSource(url);

	es.addEventListener("alert", (event) => {
		try {
			const raw = JSON.parse(event.data);
			onAlert(transformAlert(raw));
		} catch {
		}
	});

	return () => {
		es.close();
	};
}

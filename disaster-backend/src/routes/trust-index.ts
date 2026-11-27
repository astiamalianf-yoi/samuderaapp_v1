import { Hono } from "hono";
import { currentTrustIndex } from "../lib/trust-index";

const route = new Hono();

/** GET /api/trust-index — the live Trust Index of the 17 signs (Paper 2, Eq. 2-3). Open to everyone. */
route.get("/trust-index", (c) => {
	c.header("Cache-Control", "public, max-age=300");
	return c.json({ ok: true, ...currentTrustIndex() });
});

export default route;

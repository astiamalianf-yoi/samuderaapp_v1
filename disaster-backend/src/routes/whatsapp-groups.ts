import { Hono } from "hono";
import { WHATSAPP_GROUP_LINKS } from "../config";

/** Invite link of each beach's WhatsApp group (public: the app shows it to everyone). */
const route = new Hono();
route.get("/whatsapp/groups", (c) => c.json({ ok: true, data: WHATSAPP_GROUP_LINKS }));
export default route;

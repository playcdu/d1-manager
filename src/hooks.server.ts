import { extend } from "$lib/log";
import { DBMS } from "$lib/server/db/dbms";
import type { Handle, HandleServerError } from "@sveltejs/kit";
import { locale, waitLocale } from "svelte-i18n";

/**
 * Detect the Cloudflare-assigned `*.pages.dev` domains, which we do not want to
 * serve the manager on: only the custom domain should be reachable.
 */
export function is_pages_dev(host: string | null | undefined): boolean {
	if (!host) {
		return false;
	}

	const parts = host.split(".");
	const tld = parts.pop();
	const domain = parts.pop();

	return domain === "pages" && tld === "dev";
}

export const handle: Handle = async ({ event, resolve }) => {
	if (is_pages_dev(event.request.headers.get("host"))) {
		return new Response("I'm a teapot", { status: 418 });
	}

	const lang = event.request.headers.get("accept-language")?.split(",")[0] || "en";
	locale.set(lang);
	await waitLocale(lang);

	event.locals.db = DBMS(event.platform?.env || {});

	const result = await resolve(event);
	return result;
};

const elog = extend("server-error");
elog.enabled = true;

export const handleError: HandleServerError = async ({ error }) => {
	elog(error);

	if (error instanceof Error && error.message.startsWith("D1_")) {
		return {
			code: 400,
			message: error.message,
		};
	}

	return {
		code: 500,
		message: "Internal Server Error",
	};
};

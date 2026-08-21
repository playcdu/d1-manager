import { describe, expect, it } from "vitest";
import { is_pages_dev } from "./hooks.server";

describe("is_pages_dev", () => {
	it("matches the Cloudflare preview domains", () => {
		expect(is_pages_dev("d1-manager.pages.dev")).toBe(true);
		expect(is_pages_dev("abcd1234.d1-manager.pages.dev")).toBe(true);
		expect(is_pages_dev("pages.dev")).toBe(true);
	});

	it("does not match custom domains", () => {
		expect(is_pages_dev("d1.craftdownunder.co")).toBe(false);
		expect(is_pages_dev("pages.dev.example.com")).toBe(false);
		expect(is_pages_dev("notpages.dev")).toBe(false);
		expect(is_pages_dev("localhost:5173")).toBe(false);
	});

	it("does not match a missing host header", () => {
		expect(is_pages_dev(null)).toBe(false);
		expect(is_pages_dev("")).toBe(false);
	});
});

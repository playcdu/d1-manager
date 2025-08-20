<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { page } from "$app/stores";
	import { is_dangerous } from "$lib/sql";
	import { t } from "svelte-i18n";
	import type { PageData } from "./$types";

	export let data: PageData;

	let query = "";
	$: danger = is_dangerous(query);

	function handler(evt: KeyboardEvent) {
		if (evt.code === "Enter" && evt.shiftKey === true && query) {
			run();
		}
	}

	let running = false;
	let duration: number | undefined;
	let error = "";
	async function run() {
		if (running) {
			return;
		}
		running = true;

		try {
			const q = query
				.split(";")
				.filter((q) => q.trim())
				.map((q) => q.replace(/\n/g, "\\n"))
				.join("\n");
			const res = await fetch(`/api/db/${$page.params.database}/exec`, {
				method: "POST",
				body: JSON.stringify({ query: q }),
			});

			const json = await res.json<any>();
			if (json) {
				if (res.status == 500 && json.code == 400) {
					error = json?.message;
					duration = undefined;
				} else if (res.status == 500) {
					error = "An unknown error has occurred.  Check the browser devtools for more.";
					duration = undefined;
				} else {
					duration = json.duration;
					error = "";
					await invalidateAll();
				}
			} else {
				throw new Error("Unknown");
			}
		} catch (err) {
			error = err instanceof Error ? err.message : "Unknown";
			duration = undefined;
		} finally {
			running = false;
		}
	}
</script>

<svelte:head>
	<title>{$page.params.database} | {$t("d1-manager.name")}</title>
	<meta
		name="description"
		content={$t("d1-manager-manage-db", { values: { db: $page.params.database } })}
	/>
</svelte:head>

<div class="flex w-full flex-col items-center justify-start gap-4 p-4">
	{#each data.db as table}
		<a class="w-full" href="/db/{$page.params.database}/{table.name}">
			<div
				class="card-bordered card w-full bg-base-200 transition-all hover:scale-[1.01] hover:shadow-md"
			>
				<div class="card-body">
					<h2 class="card-title">{table.name}</h2>
					<p>{$t("rows")}: {table.count}</p>
					<div class="card-actions justify-end">
						<button class="btn-primary btn">{$t("explore")}</button>
					</div>
				</div>
			</div>
		</a>
	{/each}
</div>

<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { page } from "$app/stores";
	import { is_dangerous } from "$lib/sql";
	import { t } from "svelte-i18n";
	import type { PageData } from "./$types";
	import { sqlite2sql } from "$lib/sqlite2sql";

	export let data: PageData;

	let query = "";
	$: danger = is_dangerous(query);
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
				.map((q) => q.replace(/\\n/g, "\n"))
				.join(";\n");
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
	async function import_db() {
		const file = document.createElement("input");
		file.type = "file";
		file.accept = ".sqlite3,.sqlite,.db,.sql";
		file.onchange = async () => {
			if (file.files?.length !== 1) {
				return;
			}
			const db = file.files[0];
			let sql: string;
			if (db.name.endsWith(".sql")) {
				sql = await db.text();
			} else {
				sql = await sqlite2sql(await db.arrayBuffer());
			}
			query = sql;
			file.remove();
		};
		file.click();
	}
</script>

<svelte:head>
	<title>{$page.params.database} | {$t("d1-manager.name")}</title>
	<meta
		name="description"
		content={$t("d1-manager-manage-db", { values: { db: $page.params.database } })}
	/>
</svelte:head>

<div class="space-y-4">
	<div class="flex justify-between items-center">
		<h1 class="text-2xl font-bold">{$page.params.database}</h1>
		<div class="flex gap-2">
			<button class="btn btn-sm btn-outline" on:click={import_db}>
				{$t("import")}
			</button>
			<a
				class="btn btn-sm btn-outline"
				href="/api/db/{$page.params.database}/dump/db-{$page.params.database}.sqlite3"
				target="_blank"
				rel="noreferrer"
			>
				{$t("download")}
			</a>
		</div>
	</div>

	<div class="tabs tabs-boxed">
		<a class="tab tab-active">{$t("query")}</a>
		<a class="tab">{$t("tables")}</a>
	</div>

	<div>
		<textarea
			class="textarea textarea-bordered w-full font-mono"
			class:textarea-error={danger}
			rows="10"
			placeholder="SELECT * FROM users;"
			bind:value={query}
			disabled={running}
		></textarea>
		<div class="mt-2 flex justify-between items-center">
			<div>
				{#if error}
					<div class="text-error">{error}</div>
				{:else if duration}
					<div class="text-sm">
						{$t("n-ms", { values: { n: duration.toFixed(2) } })}
					</div>
				{/if}
			</div>
			<button class="btn btn-primary" class:btn-error={danger} on:click={run} disabled={running}>
				{#if running}
					<span class="loading loading-spinner"></span>
				{/if}
				{$t("execute")}
			</button>
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each data.db as table}
			<a href="/db/{$page.params.database}/{table.name}">
				<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
					<div class="card-body">
						<h2 class="card-title">{table.name}</h2>
						<p>{$t("n-rows", { values: { n: table.count } })}</p>
					</div>
				</div>
			</a>
		{/each}
	</div>
</div>

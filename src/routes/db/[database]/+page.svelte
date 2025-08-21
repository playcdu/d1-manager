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

			console.log(sql);

			const res = await fetch(`/api/db/${$page.params.database}/exec`, {
				method: "POST",
				body: JSON.stringify({ query: sql }),
			});

			if (res.ok) {
				await invalidateAll();
			} else {
				alert(await res.text());
			}

			file.remove();
		};
		file.click();
	}
</script>

<svelte:head>
	<title>{$page.params.database} | Craft Down Under</title>
	<meta name="description" content="Manage the {$page.params.database} database." />
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="grid grid-cols-2 gap-4">
		<div class="rounded-lg bg-white/60 p-4 shadow backdrop-blur-lg">
			<div class="text-sm font-medium text-gray-500">{$t("tables")}</div>
			<div class="text-5xl font-bold">{data.db.length}</div>
		</div>
		<div class="rounded-lg bg-white/60 p-4 shadow backdrop-blur-lg">
			<div class="text-sm font-medium text-gray-500">{$t("total-rows")}</div>
			<div class="text-5xl font-bold">{data.db.reduce((acc, t) => acc + t.count, 0)}</div>
		</div>
	</div>

	<div class="flex gap-2">
		<button
			class="btn btn-primary shadow-md transition-all hover:shadow-lg"
			on:click={import_db}
		>
			<Icon icon="mdi:database-import-outline" class="text-xl" />
			{$t("import")}
		</button>
		<a
			class="btn shadow-md backdrop-blur-lg transition-all hover:shadow-lg"
			href="/api/db/{$page.params.database}/dump/db-{$page.params.database}.sqlite3"
			target="_blank"
			rel="noreferrer"
		>
			<Icon icon="mdi:database-export-outline" class="text-xl" />
			{$t("download")}
		</a>
	</div>

	<div class="rounded-lg border border-gray-300 bg-white/60 p-4 shadow backdrop-blur-lg">
		<div class="flex">
			<textarea
				class="w-full flex-1 rounded-l-md border border-gray-300 bg-white/60 p-2 font-mono text-lg backdrop-blur-lg focus:border-blue-500 focus:ring-blue-500"
				class:border-red-500={danger}
				placeholder="Execute SQL query in {$page.params.database}"
				bind:value={query}
				on:keypress={handler}
				disabled={running}
			></textarea>
			{#if query}
				<button
					class="btn btn-primary rounded-l-none"
					class:bg-red-500={danger}
					on:click={run}
					disabled={running}
				>
					Execute
				</button>
			{/if}
		</div>

		{#if error}
			<div class="mt-2 text-red-500">{error}</div>
		{:else if duration}
			<div class="mt-2 text-sm text-gray-500">
				{$t("n-ms", { values: { n: duration.toFixed(2) } })}
			</div>
		{/if}
	</div>
</div>

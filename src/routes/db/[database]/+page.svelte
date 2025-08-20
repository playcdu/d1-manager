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
		const file = document.createElement('input');
		file.type = 'file';
		file.accept = '.sqlite3,.sqlite,.db,.sql';
		file.onchange = async () => {
			if (file.files?.length !== 1) {
				return;
			}

			const db = file.files[0];
			let sql: string;
			if (db.name.endsWith('.sql')) {
				sql = await db.text();
			} else {
				sql = await sqlite2sql(await db.arrayBuffer());
			}

			console.log(sql);

			const res = await fetch(`/api/db/${$page.params.database}/exec`, {
				method: 'POST',
				body: JSON.stringify({ query: sql })
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
	<meta
		name="description"
		content="Manage the {$page.params.database} database."
	/>
</svelte:head>

<div class="flex w-full flex-col items-center justify-start gap-4">
	<div class="stats shadow border border-white border-opacity-20 bg-white bg-opacity-10 backdrop-blur-lg">
		<div class="stat">
			<div class="stat-title">{$t("tables")}</div>
			<div class="stat-value">{data.db.length}</div>
		</div>

		<div class="stat">
			<div class="stat-title">{$t("total-rows")}</div>
			<div class="stat-value">{data.db.reduce((acc, t) => acc + t.count, 0)}</div>
		</div>
	</div>

	<div class="flex gap-2">
		<button class="btn-outline btn-sm btn" on:click={import_db}>
			{$t('import')}
		</button>
		<a
			class="btn-outline btn-sm btn"
			href="/api/db/{$page.params.database}/dump/db-{$page.params.database}.sqlite3"
			target="_blank"
			rel="noreferrer"
		>
			{$t('download')}
		</a>
	</div>

	<div class="card w-full border border-white border-opacity-20 bg-white bg-opacity-10 shadow-lg backdrop-blur-lg">
		<div class="card-body">
			<div class="join">
				<textarea
					class="textarea-border textarea focus:textarea-primary join-item h-10 w-full flex-1 resize-y !rounded-l-lg font-mono transition-colors"
					class:!outline-error={danger}
					placeholder="Execute SQL query in {$page.params.database}"
					bind:value={query}
					on:keypress={handler}
					disabled={running}
				></textarea>
				{#if query}
					<button
						class="btn-primary btn join-item h-auto min-w-[6rem]"
						class:btn-error={danger}
						on:click={run}
						disabled={running}
					>
						Execute
					</button>
				{/if}
			</div>

			{#if error}
				<div class="text-error mt-2">{error}</div>
			{:else if duration}
				<div class="mt-2 text-sm">
					{$t('n-ms', { values: { n: duration.toFixed(2) } })}
				</div>
			{/if}
		</div>
	</div>
</div>

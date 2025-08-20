<script lang="ts">
	import { t } from "svelte-i18n";
	import { is_dangerous, is_readonly } from "../sql";
	import { export_csv } from "$lib/csv";

	export let database: string;
	export let table: string;

	let query = $t("show-first-10-records", { values: { table } });
	let running = false;
	let suggestion: string | undefined;
	$: danger = is_dangerous(suggestion || "");
	let result: D1Result<any> | undefined;
	let error: string | undefined;
	async function suggest() {
		if (running) {
			return;
		}
		running = true;
		try {
			const res = await fetch(`/api/db/${database}/assistant`, {
				method: "POST",
				body: JSON.stringify({ q: query, t: table }),
			});
			const json = await res.json<{ sql: string } | { message: string }>();
			if (json) {
				if ("message" in json) {
					throw new Error(json.message);
				}
				suggestion = json.sql;
			} else {
				throw new Error($t("plugin.semantic-query.no-result"));
			}
		} catch (e) {
			if (e instanceof Error) {
				error = e.message;
			} else {
				error = $t("plugin.semantic-query.unknown-error");
			}
		} finally {
			running = false;
			if (is_readonly(suggestion || "")) {
				run();
			}
		}
	}
	async function run() {
		if (!suggestion) {
			return;
		}
		if (running) {
			return;
		}
		running = true;
		try {
			const res = await fetch(`/api/db/${database}/all`, {
				method: "POST",
				body: JSON.stringify({ query: suggestion }),
			});
			const json = await res.json<D1Result | { message: string }>();
			if (json) {
				if ("message" in json) {
					throw new Error(json.message);
				}
				result = json;
				error = undefined;
			} else {
				throw new Error($t("plugin.semantic-query.no-result"));
			}
		} catch (err) {
			result = undefined;
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = $t("plugin.semantic-query.unknown-error");
			}
		} finally {
			running = false;
		}
	}
</script>

<div class="space-y-4">
	<p class="text-sm opacity-70">
		{$t("plugin.semantic-query.requires-openai_api_key")}
		<br />
		{$t("plugin.semantic-query.autorun-on-read-only-queries")}
	</p>

	<div class="form-control">
		<textarea
			class="textarea textarea-bordered w-full"
			rows="3"
			placeholder={$t("show-first-10-records")}
			bind:value={query}
			disabled={running}
		></textarea>
	</div>
	<div class="flex justify-end">
		<button class="btn btn-primary" on:click={suggest} disabled={running}>
			{#if running && !suggestion}
				<span class="loading loading-spinner"></span>
			{/if}
			{$t("plugin.semantic-query.suggest")}
		</button>
	</div>

	{#if suggestion}
		<div class="form-control">
			<textarea
				class="textarea textarea-bordered w-full font-mono"
				rows="5"
				placeholder="SELECT * FROM users;"
				bind:value={suggestion}
				disabled={running}
			></textarea>
		</div>
		<div class="flex justify-end">
			<button class="btn btn-primary" class:btn-error={danger} on:click={run} disabled={running}>
				{#if running && suggestion}
					<span class="loading loading-spinner"></span>
				{/if}
				{$t("plugin.semantic-query.run")}
			</button>
		</div>
	{/if}

	{#if result}
		{#if result.results?.length}
			<div class="overflow-x-auto">
				<table class="table table-zebra table-sm w-full">
					<thead>
						<tr>
							{#each Object.keys(result.results[0]) as key}
								<th>{key}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each result.results as row}
							<tr>
								{#each Object.values(row) as value}
									<td class:opacity-50={value === null}>{value}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="flex justify-between items-center">
				<p class="text-sm opacity-70">
					{$t("plugin.semantic-query.n-ms-m-changes", {
						values: {
							n: result.meta.duration.toFixed(2),
							rr: result.meta.rows_read ?? "x",
							rw: result.meta.rows_written ?? result.meta.changes,
						},
					})}
				</p>
				<button
					class="btn btn-sm btn-outline"
					on:click={() => (result ? export_csv(result.results, table) : undefined)}
				>
					{$t("plugin.semantic-query.export")}
				</button>
			</div>
		{:else}
			<p>{$t("plugin.semantic-query.no-results")}</p>
		{/if}
	{/if}

	{#if error}
		<div class="alert alert-error">
			<div>{error}</div>
		</div>
	{/if}
</div>

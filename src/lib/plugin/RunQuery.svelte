<script lang="ts">
	import { t } from "svelte-i18n";
	import { is_dangerous } from "../sql";
	import { export_csv } from "$lib/csv";

	export let database: string;
	export let table: string;

	$: query = `SELECT * FROM \`${table}\` LIMIT 100`;
	$: danger = is_dangerous(query);
	let running = false;
	let result: D1Result<any> | undefined;
	let error: string | undefined;
	async function run() {
		if (running) {
			return;
		}
		running = true;
		try {
			const res = await fetch(`/api/db/${database}/all`, {
				method: "POST",
				body: JSON.stringify({ query }),
			});
			const json = await res.json<D1Result | { message: string }>();
			if (json) {
				if ("message" in json) {
					throw new Error(json.message);
				}
				result = json;
				error = undefined;
			} else {
				throw new Error($t("plugin.run-query.no-result"));
			}
		} catch (err) {
			result = undefined;
			if (err instanceof Error) {
				error = err.message;
			} else {
				error = $t("plugin.run-query.unknown-error");
			}
		} finally {
			running = false;
		}
	}
</script>

<div class="space-y-4">
	<textarea
		class="textarea textarea-bordered w-full font-mono"
		rows="5"
		placeholder="SELECT * FROM users;"
		bind:value={query}
		disabled={running}
	></textarea>
	<div class="flex justify-end">
		<button class="btn btn-primary" class:btn-error={danger} on:click={run} disabled={running}>
			{#if running}
				<span class="loading loading-spinner"></span>
			{/if}
			{$t("plugin.run-query.run")}
		</button>
	</div>

	{#if result}
		{#if result?.results?.length}
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
					{$t("plugin.run-query.n-ms-m-changes", {
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
					{$t("plugin.run-query.export")}
				</button>
			</div>
		{:else}
			<p>{$t("plugin.run-query.no-results")}</p>
		{/if}
	{/if}

	{#if error}
		<div class="alert alert-error">
			<div>{error}</div>
		</div>
	{/if}
</div>

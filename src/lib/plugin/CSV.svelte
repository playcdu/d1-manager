<script lang="ts">
	import { t } from "svelte-i18n";
	import type { PluginData } from "./type";
	import type { Type } from "../sqlite";
	import { affinity, cast } from "../sqlite";

	export let database: string;
	export let table: string;
	export let data: PluginData;

	const cols = data.db
		.find(({ name }) => name === table)
		?.columns.sort(({ cid: a }, { cid: b }) => a - b);
	if (!cols) {
		throw new Error(`Table not found: ${table} in ${database}`);
	}
	const types: Record<string, Type> = Object.fromEntries(
		cols.map(({ name, type }) => [name, affinity(type)]),
	);
	let running = false;
	let result:
		| {
				results: Record<string, unknown>[];
				success: boolean;
				meta: {
					duration: number;
					last_row_id: number;
					changes: number;
					served_by: string;
					internal_stats: null;
				};
		  }
		| undefined;
	let error: string | undefined;
	let files: FileList | undefined;
	let keys: string[] | undefined;
	let casted: any[][] | undefined;
	async function read() {
		if (running) {
			return;
		}
		running = true;
		try {
			const { parse } = await import("csv-parse/browser/esm/sync");
			const file = files?.[0];
			if (!file) {
				return;
			}
			const text = await file.text();
			const rows: Record<string, string>[] = parse(text, {
				columns: true,
				skip_empty_lines: true,
			});
			keys = Object.keys(rows[0]);
			for (const key of keys) {
				if (!types[key]) {
					throw new Error($t("plugin.csv.invalid-column-name-key", { values: { key } }));
				}
			}
			casted = rows.map((row) => {
				return (keys || []).map((key) => {
					const value = row[key];
					const type = types[key];
					return cast(value, type);
				});
			});
			error = undefined;
		} catch (err) {
			console.error(err);
			if (err instanceof Error) {
				error = err.message;
			}
		} finally {
			running = false;
		}
	}
	async function import_csv() {
		if (running || !casted) {
			return;
		}
		running = true;
		try {
			const bodies = split(casted, 90_000);
			function split(arr: any[][], size: number): string[] {
				const bodies: string[] = [""];
				for (let i = 0; i < arr.length; i++) {
					if (bodies[bodies.length - 1].length >= size) {
						bodies.push("");
					}
					if (bodies[bodies.length - 1].length > 0) {
						bodies[bodies.length - 1] += ", ";
					}
					bodies[bodies.length - 1] +=
						`(${arr[i].map((x) => JSON.stringify(x)).join(", ")})`;
				}
				return bodies;
			}
			const queries = bodies.map(
				(body) => `INSERT INTO ${table} (${keys?.join(", ")}) VALUES ${body}`,
			);
			console.log(queries);
			let r: typeof result = undefined;
			for (const query of queries) {
				const res = await fetch(`/api/db/${database}/all`, {
					method: "POST",
					body: JSON.stringify({ query }),
				});
				const json = await res.json<any>();
				if (json) {
					if ("error" in json) {
						error = json?.error?.cause || json?.error?.message;
						r = undefined;
					} else {
						if (r) {
							r.meta.duration += json.meta.duration;
							r.meta.changes += json.meta.changes;
						} else {
							r = json;
						}
						error = undefined;
						files = undefined;
						keys = undefined;
						casted = undefined;
					}
					result = r;
				} else {
					throw new Error($t("plugin.csv.no-result"));
				}
			}
		} finally {
			running = false;
		}
	}
	async function export_csv() {
		if (running) {
			return;
		}
		running = true;
		try {
			const module = import("csv-stringify/browser/esm/sync");
			const res = await fetch(`/api/db/${database}/${table}/data`);
			const json = await res.json<any>();
			const { stringify } = await module;
			const csv = stringify(json, {
				header: true,
				columns: keys,
			});
			const a = document.createElement("a");
			a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
			a.setAttribute("download", `${table}.csv`);
			a.click();
			URL.revokeObjectURL(a.href);
			a.remove();
		} finally {
			running = false;
		}
	}
</script>

<div class="space-y-4">
	<div class="form-control">
		<label class="label" for="csv">
			<span class="label-text">{$t("plugin.csv.import-csv")}</span>
		</label>
		<input
			id="csv"
			type="file"
			class="file-input file-input-bordered"
			bind:files
			accept=".csv"
			on:change={read}
			disabled={running}
		/>
	</div>

	{#if keys && casted?.length}
		<div class="overflow-x-auto">
			<table class="table table-zebra table-sm w-full">
				<thead>
					<tr>
						{#each keys as key}
							<th>{key}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each casted as row}
						<tr>
							{#each row as value}
								<td>{value}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<button class="btn btn-primary w-full" on:click={import_csv} disabled={running}>
			{#if running}
				<span class="loading loading-spinner"></span>
			{/if}
			{$t("plugin.csv.import")}
		</button>
	{/if}

	{#if result}
		<p class="text-sm">
			{$t("plugin.csv.n-ms-m-changes", {
				values: {
					n: result.meta.duration.toFixed(2),
					m: result.meta.changes,
				},
			})}
		</p>
	{/if}

	<div class="divider">{$t("or")}</div>

	<button class="btn btn-outline w-full" on:click={export_csv} disabled={running}>
		{#if running}
			<span class="loading loading-spinner"></span>
		{/if}
		{$t("plugin.csv.export-csv")}
	</button>

	{#if error}
		<div class="alert alert-error">
			<div>{error}</div>
		</div>
	{/if}
</div>

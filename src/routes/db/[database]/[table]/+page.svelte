<script lang="ts">
	import { page } from "$app/stores";
	import { t } from "svelte-i18n";
	import type { PageData } from "./$types";
	import { onMount } from "svelte";
	import Icon from "@iconify/svelte";
	import { is_readonly } from "$lib/sql";
	import { export_csv } from "$lib/csv";
	import { z } from "zod";
	import { affinity, cast, type Type } from "$lib/sqlite";

	export let data: PageData;
	const meta = data.db.find((table) => table.name === $page.params.table);
	if (!meta) {
		throw new Error(`Table not found: ${$page.params.table} in ${$page.params.database}`);
	}

	let activeTab: "structure" | "browse" | "query" | "insert" | "csv" = "structure";

	// Shared
	const database = $page.params.database;
	const table = $page.params.table;
	let running = false;

	// Browse Tab Logic (from TableBrowser.svelte)
	const cols =
		data.db
			.find(({ name }) => name === table)
			?.columns.sort(({ cid: a }, { cid: b }) => a - b)
			.map(({ name }) => name) || [];
	let locked = true;
	let offset = 0;
	let limit = 20;
	let order = "";
	let dir: "ASC" | "DESC" = "ASC";
	let browseResult: Record<string, unknown>[] | undefined;
	let browseError: { error: { message: string; cause?: string } } | undefined;

	$: if (activeTab === "browse" && !browseResult) {
		browseTable();
	}

	async function browseTable() {
		if (running) return;
		running = true;
		try {
			const params = new URLSearchParams();
			params.set("select", `rowid AS _, ${cols.join(", ")}`);
			params.set("offset", offset.toString());
			params.set("limit", limit.toString());
			if (order) {
				params.set("order", order);
				params.set("dir", dir);
			}
			const res = await fetch(`/api/db/${database}/${table}/data?${params.toString()}`);
			const json = await res.json<typeof browseResult | typeof browseError>();
			if (json) {
				if ("error" in json) {
					browseError = json;
					browseResult = undefined;
				} else {
					browseResult = json;
					browseError = undefined;
				}
			} else {
				throw new Error("No result from browse API");
			}
		} catch (err) {
			browseError = { error: { message: err instanceof Error ? err.message : "Unknown error" } };
			browseResult = undefined;
		} finally {
			running = false;
		}
	}

	function change_sort(col: string) {
		if (order === col) {
			dir = dir === "ASC" ? "DESC" : "ASC";
		} else {
			order = col;
			dir = "ASC";
		}
		browseTable();
	}

	async function removeRow(rowid: unknown) {
		if (running) return;
		running = true;
		try {
			if (typeof rowid !== "number") throw new Error("Invalid rowid");
			await fetch(`/api/db/${database}/${table}/data/?rowid=${rowid}`, { method: "DELETE" });
		} finally {
			running = false;
			await browseTable();
		}
	}

	async function editCell(rowid: unknown, col: string) {
		if (running) return;
		running = true;
		const record = browseResult?.find((r) => r._ === rowid);
		try {
			if (typeof rowid !== "number") throw new Error("Invalid rowid");
			if (!record) throw new Error("No record found");
			await fetch(`/api/db/${database}/${table}/data/?rowid=${rowid}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...record, _: undefined }),
			});
		} finally {
			running = false;
			await browseTable();
		}
	}

	// Query Tab Logic (from RunQuery.svelte & SemanticQuery.svelte)
	let query = `SELECT * FROM \`${table}\` LIMIT 100`;
	let queryError: string | undefined;
	let queryResult: D1Result<any> | undefined;
	let suggestion = "";
	let suggestionError: string | undefined;

	async function runQuery() {
		if (running) return;
		running = true;
		queryError = undefined;
		queryResult = undefined;
		try {
			const res = await fetch(`/api/db/${database}/all`, {
				method: "POST",
				body: JSON.stringify({ query }),
			});
			const json = await res.json<D1Result | { message: string }>();
			if ("message" in json) throw new Error(json.message);
			queryResult = json;
		} catch (err) {
			if (err instanceof Error) queryError = err.message;
		} finally {
			running = false;
		}
	}

	async function suggestQuery() {
		if (running) return;
		running = true;
		suggestionError = undefined;
		try {
			const res = await fetch(`/api/db/${database}/assistant`, {
				method: "POST",
				body: JSON.stringify({ q: suggestion, t: table }),
			});
			const json = await res.json<{ sql: string } | { message: string }>();
			if ("message" in json) throw new Error(json.message);
			query = json.sql;
			if (is_readonly(query)) {
				runQuery();
			}
		} catch (e) {
			if (e instanceof Error) suggestionError = e.message;
		} finally {
			running = false;
		}
	}

	// Insert Tab Logic (from AddRecord.svelte)
	const insert_cols = meta.columns.sort(({ cid: a }, { cid: b }) => a - b);
	let record = Object.fromEntries<{ type: string; val: string; err: string; nullable: boolean }>(
		insert_cols.map(({ name, type, dflt_value, notnull }) => [
			name,
			{
				type,
				val: dflt_value ?? "",
				err: type_check(type, dflt_value ?? ""),
				nullable: !!notnull,
			},
		]),
	);
	let insertResult: any | undefined;
	let insertError: any | undefined;

	function type_check(type: string, val: string): string {
		try {
			switch (type) {
				case "INTEGER":
					z.string().regex(/^\d*$/).parse(val);
					break;
				case "TEXT":
					z.string().parse(val);
					break;
				case "REAL":
					z.string().regex(/^\d*(\.\d+)?$/).parse(val);
					break;
			}
		} catch (err) {
			if (err instanceof z.ZodError) return err.issues[0].message;
			return "Unknown error";
		}
		return "";
	}

	async function addRecord() {
		if (running) return;
		running = true;
		insertResult = undefined;
		insertError = undefined;
		const data = Object.fromEntries(
			Object.entries(record)
				.map(([key, { val }]) => [key, val ? val : undefined])
				.filter(([_, val]) => val !== undefined),
		);
		try {
			const res = await fetch(`/api/db/${database}/${table}/data`, {
				method: "POST",
				body: JSON.stringify(data),
			});
			const json = await res.json();
			if (json.error) throw json.error;
			insertResult = json;
		} catch (err) {
			insertError = err;
		} finally {
			running = false;
		}
	}

	// CSV Tab Logic (from CSV.svelte)
	const csv_cols = meta.columns.sort(({ cid: a }, { cid: b }) => a - b);
	const types: Record<string, Type> = Object.fromEntries(
		csv_cols.map(({ name, type }) => [name, affinity(type)]),
	);
	let files: FileList | undefined;
	let csvError: string | undefined;
	let casted: any[][] | undefined;
	let csv_keys: string[] | undefined;
	let importResult: any | undefined;

	async function readCSV() {
		if (running) return;
		running = true;
		csvError = undefined;
		casted = undefined;
		csv_keys = undefined;
		try {
			const { parse } = await import("csv-parse/browser/esm/sync");
			const file = files?.[0];
			if (!file) return;
			const text = await file.text();
			const rows: Record<string, string>[] = parse(text, { columns: true, skip_empty_lines: true });
			csv_keys = Object.keys(rows[0]);
			for (const key of csv_keys) {
				if (!types[key]) throw new Error(`Invalid column name: ${key}`);
			}
			casted = rows.map((row) => (csv_keys || []).map((key) => cast(row[key], types[key])));
		} catch (err) {
			if (err instanceof Error) csvError = err.message;
		} finally {
			running = false;
		}
	}

	async function importCSV() {
		if (running || !casted) return;
		running = true;
		importResult = undefined;
		try {
			const bodies = (arr: any[][], size: number) => {
				const bodies: string[] = [""];
				for (let i = 0; i < arr.length; i++) {
					if (bodies[bodies.length - 1].length >= size) bodies.push("");
					if (bodies[bodies.length - 1].length > 0) bodies[bodies.length - 1] += ", ";
					bodies[bodies.length - 1] += `(${arr[i].map((x) => JSON.stringify(x)).join(", ")})`;
				}
				return bodies;
			};
			const queries = bodies(casted, 90_000).map(
				(body) => `INSERT INTO ${table} (${csv_keys?.join(", ")}) VALUES ${body}`,
			);
			let r: any | undefined;
			for (const q of queries) {
				const res = await fetch(`/api/db/${database}/all`, { method: "POST", body: JSON.stringify({ query: q }) });
				const json = await res.json<any>();
				if (json.error) throw new Error(json.error.cause || json.error.message);
				if (r) {
					r.meta.duration += json.meta.duration;
					r.meta.changes += json.meta.changes;
				} else {
					r = json;
				}
				files = undefined;
				csv_keys = undefined;
				casted = undefined;
			}
			importResult = r;
		} finally {
			running = false;
		}
	}
</script>

<svelte:head>
	<title>{$page.params.table} @ {$page.params.database} | {$t("d1-manager.name")}</title>
	<meta
		name="description"
		content={$t("d1-manager-manage-db", { values: { db: $page.params.table } })}
	/>
</svelte:head>

<div class="p-4">
	<div class="tabs-boxed tabs">
		<a class="tab" class:tab-active={activeTab === 'structure'} on:click={() => (activeTab = 'structure')}>{$t("structure")}</a>
		<a class="tab" class:tab-active={activeTab === 'browse'} on:click={() => (activeTab = 'browse')}>{$t("browse")}</a>
		<a class="tab" class:tab-active={activeTab === 'query'} on:click={() => (activeTab = 'query')}>{$t("query")}</a>
		<a class="tab" class:tab-active={activeTab === 'insert'} on:click={() => (activeTab = 'insert')}>{$t("insert")}</a>
		<a class="tab" class:tab-active={activeTab === 'csv'} on:click={() => (activeTab = 'csv')}>{$t("csv")}</a>
	</div>

	<div class="pt-4">
		{#if activeTab === 'structure'}
			<div class="card-bordered card w-full bg-base-200">
				<div class="card-body">
					<h2 class="card-title">{meta.name}</h2>
					<div class="divider"></div>
					<ul class="menu">
						{#each meta.columns as column}
							<li class:font-bold={column.pk}>
								<a>{column.name}<span class="badge-ghost badge">{column.type}</span></a>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		{:else if activeTab === 'browse'}
			<div class="card-bordered card w-full bg-base-200">
				<div class="card-body">
					<div class="form-control">
						<label class="label cursor-pointer">
							<span class="label-text">{locked ? "Table is Locked" : "Table is Unlocked"}</span>
							<input type="checkbox" class="toggle" bind:checked={locked} />
						</label>
					</div>
					{#if browseResult}
						<div class="max-h-[80vh] overflow-auto"><table class="table-sm table min-w-full">
							<thead><tr class="sticky top-0 z-10 bg-base-300 shadow">
								{#each cols as col}
									<th class="!relative cursor-pointer normal-case" on:click={() => change_sort(col)}>
										{col}
										{#if order === col}<span class="text-sm font-normal opacity-50">{dir}</span>{/if}
									</th>
								{/each}
								<th />
							</tr></thead>
							<tbody>
								{#each browseResult as row}
								<tr class="group hover">
									{#each Object.keys(row) as key}
										{#if key !== '_'}
										<td>
											{#if typeof row[key] === 'number'}
												<input class="input-ghost input input-xs w-full" type="number" bind:value={row[key]} on:blur={() => editCell(row._, key)} disabled={locked || running} />
											{:else}
												<input class="input-ghost input input-xs w-full" bind:value={row[key]} on:change={() => editCell(row._, key)} disabled={locked || running} />
											{/if}
										</td>
										{/if}
									{/each}
									<td><div class="pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100">
										<button class="btn-error btn-xs btn" on:click={() => removeRow(row._)} disabled={locked || running}><Icon class="text-lg" icon="mdi:delete-outline" /></button>
									</div></td>
								</tr>
								{/each}
							</tbody>
						</table></div>
						<div class="join mt-4 grid grid-cols-2">
							<button class="btn-outline join-item btn" on:click={() => { offset -= limit; browseTable(); }} disabled={running || offset <= 0}>Previous</button>
							<button class="btn-outline join-item btn" on:click={() => { offset += limit; browseTable(); }} disabled={running || browseResult.length < limit}>Next</button>
						</div>
					{/if}
					{#if browseError}
						<div class="alert alert-error shadow-lg"><div>{browseError.error.cause || browseError.error.message}</div></div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'query'}
			<div class="card-bordered card w-full bg-base-200">
				<div class="card-body">
					<div class="form-control"><div class="join w-full">
						<input class="input-bordered input join-item w-full" placeholder="Natural language query..." bind:value={suggestion} on:keypress={(e) => e.key === 'Enter' && suggestQuery()} disabled={running} />
						<button class="btn-primary btn-outline join-item btn" on:click={suggestQuery} disabled={running}>Suggest</button>
					</div>
					{#if suggestionError}<label class="label"><span class="label-text-alt text-error">{suggestionError}</span></label>{/if}
					</div>
					<div class="form-control">
						<textarea class="textarea-bordered textarea h-36 font-mono" placeholder="SELECT * FROM..." bind:value={query} on:keypress={(e) => e.shiftKey && e.key === 'Enter' && runQuery()}></textarea>
						<label class="label"><span class="label-text-alt"/><span class="label-text-alt">Shift + Enter to run</span></label>
					</div>
					<button class="btn-primary btn" on:click={runQuery} disabled={running}>Run</button>
					{#if queryResult}
						<div class="divider" />
						{#if queryResult.results?.length}
							<div class="max-h-[80vh] overflow-auto"><table class="table-sm table w-full">
								<thead><tr class="sticky top-0 z-10 bg-base-300 shadow">
									{#each Object.keys(queryResult.results[0]) as key}<th>{key}</th>{/each}
								</tr></thead>
								<tbody>
								{#each queryResult.results as row}
									<tr class="hover">
									{#each Object.values(row) as value}
										<td class:opacity-50={value === null}>{value}</td>
									{/each}
									</tr>
								{/each}
								</tbody>
							</table></div>
							<div class="mt-2 flex items-center justify-between">
								<div class="stats"><div class="stat">
									<div class="stat-title">Duration</div>
									<div class="stat-value text-sm">{queryResult.meta.duration.toFixed(2)}ms</div>
								</div>
								<div class="stat">
									<div class="stat-title">Rows Read</div>
									<div class="stat-value text-sm">{queryResult.meta.rows_read ?? "N/A"}</div>
								</div>
								<div class="stat">
									<div class="stat-title">Rows Written</div>
									<div class="stat-value text-sm">{queryResult.meta.rows_written ?? "N/A"}</div>
								</div></div>
								<button class="btn-primary btn-outline btn-sm btn" on:click={() => export_csv(queryResult.results, table)}>Export</button>
							</div>
						{:else}
							<div class="alert">No results</div>
						{/if}
					{/if}
					{#if queryError}
						<div class="divider" />
						<div class="alert alert-error shadow-lg"><div>{queryError}</div></div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'insert'}
			<div class="card-bordered card w-full bg-base-200">
				<div class="card-body">
					<table class="table">
						<thead><tr class="bg-base-300"><th class="w-40">Column</th><th>Value</th></tr></thead>
						<tbody>
						{#each insert_cols as col}
							<tr>
								<td class="w-40">{col.name}</td>
								<td>
									{#if col.type !== 'BLOB'}
									<div class="w-full">
										<input class="input-bordered input input-sm w-full" class:input-error={record[col.name].err} on:input={(e) => { record[col.name].err = type_check(col.type, e.currentTarget.value); }} placeholder={col.dflt_value || ""} />
										{#if record[col.name].err}<label class="label"><span class="label-text-alt text-error">{record[col.name].err}</span></label>{/if}
									</div>
									{:else}
									<div class="alert alert-warning">File upload not supported</div>
									{/if}
								</td>
							</tr>
						{/each}
						</tbody>
					</table>
					<div class="divider" />
					<button class="btn-primary btn" on:click={addRecord} disabled={running}>Add</button>
					{#if insertResult}<div class="alert alert-success">Success</div>{/if}
					{#if insertError}<div class="alert alert-error">{insertError.message}</div>{/if}
				</div>
			</div>
		{:else if activeTab === 'csv'}
			<div class="card-bordered card w-full bg-base-200">
				<div class="card-body">
					<div class="tabs-boxed tabs"><a class="tab">Import</a><a class="tab">Export</a></div>
					<div class="form-control w-full">
						<label class="label" for="csv"><span class="label-text">Select a CSV file</span></label>
						<input id="csv" type="file" class="file-input-bordered file-input w-full" bind:files accept=".csv" on:change={readCSV} disabled={running} />
						{#if csvError}<label class="label"><span class="label-text-alt text-error">{csvError}</span></label>{/if}
					</div>
					{#if csv_keys && casted?.length}
						<div class="my-2 max-h-[70vh] overflow-auto"><table class="table-sm table w-full">
							<thead><tr class="sticky top-0 z-10 bg-base-300 shadow">
								{#each csv_keys as key}<th>{key}</th>{/each}
							</tr></thead>
							<tbody>
							{#each casted as row}
								<tr class="hover">
								{#each row as value}<td>{value}</td>{/each}
								</tr>
							{/each}
							</tbody>
						</table></div>
						<button class="btn-primary btn w-full" on:click={importCSV} disabled={running}>Import</button>
					{/if}
					{#if importResult}
						<p class="text-sm opacity-70">Success: {importResult.meta.changes} changes in {importResult.meta.duration.toFixed(2)}ms</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

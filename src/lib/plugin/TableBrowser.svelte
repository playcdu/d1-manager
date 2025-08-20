<script lang="ts">
	import { onMount } from "svelte";
	import { t } from "svelte-i18n";
	import type { PluginData } from "./type";
	import Icon from "@iconify/svelte";

	export let database: string;
	export let table: string;
	export let data: PluginData;

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
	let select = "*";
	let where = "";
	let last_run_sql = "";
	let is_custom_sql_result = false;

	let query_mode: "semantic" | "sql" = "semantic";
	let query = "";

	let running = false;
	let result: Record<string, unknown>[] | undefined;
	let error:
		| {
				error: {
					message: string;
					cause?: string;
				};
		  }
		| undefined;

	onMount(() => {
		run();
		const saved_locked_state = localStorage.getItem('d1-manager:locked-state');
		if (saved_locked_state) {
			locked = JSON.parse(saved_locked_state);
		}
	});

	$: {
		localStorage.setItem('d1-manager:locked-state', JSON.stringify(locked));
	}

	async function _fetchTableData() {
		is_custom_sql_result = false;
		try {
			const params = new URLSearchParams();
			params.set("select", `rowid AS _, ${select}`);
			params.set("offset", offset.toString());
			params.set("limit", limit.toString());
			if (order) {
				params.set("order", order);
				params.set("dir", dir);
			}
			if (where) {
				params.set("where", where);
			}
			last_run_sql = `SELECT ${select} FROM \`${table}\`${where ? ` WHERE ${where}` : ""}${
				order ? ` ORDER BY ${order} ${dir}` : ""
			} LIMIT ${limit} OFFSET ${offset}`;
			const res = await fetch(`/api/db/${database}/${table}/data?${params.toString()}`);

			const json = await res.json<typeof result | typeof error>();
			if (json) {
				if ("error" in json) {
					error = json;
					result = undefined;
				} else {
					result = json;
					error = undefined;
				}
			} else {
				throw new Error($t("plugin.table-browser.no-result"));
			}
		} catch (err) {
			error = {
				error: {
					message:
						err instanceof Error
							? err.message
							: $t("plugin.table-browser.unknown-error"),
				},
			};
			result = undefined;
		}
	}

	async function run() {
		if (running) {
			return;
		}
		running = true;
		try {
			await _fetchTableData();
		} finally {
			running = false;
		}
	}

	async function run_query() {
		if (running) {
			return;
		}

		if (!query.trim()) {
			running = true;
			try {
				where = "";
				await _fetchTableData();
			} finally {
				running = false;
			}
			return;
		}

		running = true;
		error = undefined;

		try {
			if (query_mode === 'semantic') {
				const res = await fetch(`/api/db/${database}/assistant`, {
					method: 'POST',
					body: JSON.stringify({
						t: table,
						q: query
					})
				});

				if (!res.ok) {
					throw new Error(await res.text());
				}

				const json = await res.json();
				const sql_to_run = json.sql;

				// now execute the query
				const query_res = await fetch(`/api/db/${database}/all`, {
					method: 'POST',
					body: JSON.stringify({ query: sql_to_run })
				});
				const query_json = await query_res.json();
				if (query_res.ok) {
					if ('results' in query_json) {
						result = query_json.results;
					} else {
						result = [];
					}
					last_run_sql = sql_to_run;
					is_custom_sql_result = true;
				} else {
					if ('message' in query_json) {
						throw new Error(query_json.message);
					}
					throw new Error('SQL query failed');
				}
			} else {
				// For raw SQL, execute the query directly
				const res = await fetch(`/api/db/${database}/all`, {
					method: 'POST',
					body: JSON.stringify({ query })
				});

				const json = await res.json();
				if (res.ok) {
					if ('results' in json) {
						result = json.results;
					} else {
						result = [];
					}
					last_run_sql = query;
					is_custom_sql_result = true;
				} else {
					if ('message' in json) {
						throw new Error(json.message);
					}
					throw new Error('SQL query failed');
				}
			}
		} catch (err) {
			if (err instanceof Error) {
				error = { error: { message: err.message } };
			}
		} finally {
			running = false;
		}
	}

	function change_sort(col: string) {
		if (is_custom_sql_result) return;
		if (order === col) {
			dir = dir === "ASC" ? "DESC" : "ASC";
		} else {
			order = col;
			dir = "ASC";
		}
		run();
	}

	async function remove(rowid: unknown) {
		if (running) {
			return;
		}
		running = true;

		console.log("remove", rowid);

		try {
			if (typeof rowid !== "number") {
				throw new Error($t("plugin.table-browser.invalid-rowid"));
			}

			const res = await fetch(`/api/db/${database}/${table}/data/?rowid=${rowid}`, {
				method: "DELETE",
			});

			const json = await res.json<typeof error>();
			if (json) {
				if ("error" in json) {
					error = json;
				} else {
					error = undefined;
				}
			} else {
				throw new Error($t("plugin.table-browser.no-result"));
			}
		} catch (err) {
			error = {
				error: {
					message:
						err instanceof Error
							? err.message
							: $t("plugin.table-browser.unknown-error"),
				},
			};
			result = undefined;
		} finally {
			running = false;

			const err = error;
			await run();
			error = err;
		}
	}

	async function edit(rowid: unknown, col: string) {
		if (running) {
			return;
		}
		running = true;

		const record = result?.find((r) => r._ === rowid);

		console.log("edit", rowid, col, record);

		try {
			if (typeof rowid !== "number") {
				throw new Error($t("plugin.table-browser.invalid-rowid"));
			}
			if (!record) {
				throw new Error($t("plugin.table-browser.no-record"));
			}
			const res = await fetch(`/api/db/${database}/${table}/data/?rowid=${rowid}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...record,
					_: undefined,
				}),
			});
			const json = await res.json<typeof error>();
			if (json) {
				if ("error" in json) {
					error = json;
				} else {
					error = undefined;
				}
			} else {
				throw new Error($t("plugin.table-browser.no-result"));
			}
		} catch (err) {
			error = {
				error: {
					message:
						err instanceof Error
							? err.message
							: $t("plugin.table-browser.unknown-error"),
				},
			};
			result = undefined;
		} finally {
			running = false;

			const err = error;
			await run();
			error = err;
		}
	}
</script>

<div class="pt-4 pb-2">
	<div class="form-control w-52">
		<label class="label cursor-pointer">
			<span class="label-text">{$t(locked ? 'plugin.table-browser.table-is-locked' : 'plugin.table-browser.table-is-unlocked')}</span>
			<input type="checkbox" class="toggle toggle-primary" bind:checked={locked} />
		</label>
	</div>
</div>

<div class="tabs-boxed tabs mb-2 w-max">
	<a
		class="tab"
		class:tab-active={query_mode === 'semantic'}
		on:click={() => (query_mode = 'semantic')}>Semantic</a
	>
	<a class="tab" class:tab-active={query_mode === 'sql'} on:click={() => (query_mode = 'sql')}
		>SQL</a
	>
</div>
<form class="form-control" on:submit|preventDefault={run_query}>
	<div class="input-group">
		<input
			type="text"
			placeholder={query_mode === 'semantic' ? 'Enter a semantic query...' : 'Enter an SQL query...'}
			class="input-bordered input w-full"
			bind:value={query}
		/>
		<button type="submit" class="btn btn-primary">Query</button>
	</div>
</form>

{#if last_run_sql}
	<div class="my-4">
		<p class="text-sm font-bold uppercase tracking-wider">Last Query</p>
		<div
			class="font-mono rounded-md border border-white border-opacity-20 bg-white bg-opacity-10 p-2 text-sm backdrop-blur-lg"
		>
			{last_run_sql}
		</div>
	</div>
{/if}

{#if result}
	{#if result.length}
		<div class="max-h-[80vh] overflow-auto transition-opacity" class:opacity-50={running}>
			<table class="table-zebra table min-w-full">
				<thead>
					<tr class="bg-base-200 sticky top-0 z-10 shadow">
						{#each Object.keys(result[0] || {}) as col}
							<th
								class="!relative normal-case"
								class:cursor-pointer={!is_custom_sql_result}
								on:click={() => change_sort(col)}
								title={!is_custom_sql_result
									? $t("plugin.table-browser.click-to-sort-by", {
											values: { col }
									  })
									: undefined}
							>
								{col}
								{#if order === col && !is_custom_sql_result}
									<span class="text-sm font-normal opacity-50">{dir}</span>
								{/if}
							</th>
						{/each}
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each result as row}
						<tr class="group hover">
							{#each Object.keys(row) as key}
								{#if key !== "_"}
									<td class="border">
										{#if typeof row[key] === "number"}
											<input
												class="input-ghost input input-xs hover:input-border text-base transition-all disabled:bg-transparent"
												type="number"
												bind:value={row[key]}
												on:blur={() => edit(row._, key)}
												disabled={locked || running}
												title={locked ? $t('plugin.table-browser.table-is-locked') : undefined}
											/>
										{:else}
											<input
												class="input-ghost input input-xs hover:input-border text-base transition-all disabled:bg-transparent"
												bind:value={row[key]}
												on:change={() => edit(row._, key)}
												disabled={locked || running}
												title={locked ? $t('plugin.table-browser.table-is-locked') : undefined}
											/>
										{/if}
									</td>
								{/if}
							{/each}
							<td class="border">
								<div
									class="pointer-events-none flex items-center opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
								>
									<button
										class="btn-outline btn-error btn-xs btn"
										on:click={() => remove(row._)}
										disabled={locked || running}
									>
										<Icon class="text-lg" icon="mdi:delete-outline" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="mt-4">
			{$t("plugin.table-browser.no-results")}
		</p>
	{/if}

	<div class="flex items-center justify-between">
		{#if offset > 0 && !is_custom_sql_result}
			<button
				class="btn-ghost btn-sm btn"
				on:click={() => {
					offset -= limit;
					run();
				}}
				disabled={running}
			>
				{$t("plugin.table-browser.prev")}
			</button>
		{/if}

		<p class="flex-grow-0 px-4">
			{$t("plugin.table-browser.showing", {
				values: {
					from: result.length ? offset + 1 : offset,
					to: offset + result.length,
				},
			})}
		</p>

		{#if result.length === limit && !is_custom_sql_result}
			<button
				class="btn-ghost btn-sm btn"
				on:click={() => {
					offset += limit;
					run();
				}}
				disabled={running}
			>
				{$t("plugin.table-browser.next")}
			</button>
		{/if}
	</div>
{/if}

{#if error}
	<div class="alert alert-error shadow-lg">
		<div>{error.error.cause || error.error.message}</div>
	</div>
{/if}

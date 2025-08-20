<script lang="ts">
	import Icon from "@iconify/svelte";
	import {
		createTable,
		createRender,
		getCoreRowModel,
		getSortedRowModel,
		type RowData,
	} from "@tanstack/svelte-table";
	import { onMount } from "svelte";
	import { t } from "svelte-i18n";
	import type { PluginData } from "./type";
	import ActionsCell from "./ActionsCell.svelte";
	import TableCell from "./TableCell.svelte";

	export let database: string;
	export let table: string;

	type Person = Record<string, unknown>;
	type Doc = {
		[key: string]: unknown;
	};

	declare module "@tanstack/svelte-table" {
		interface ColumnMeta<TData extends RowData, TValue> {
			is_number?: boolean;
		}
	}

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
		const saved_locked_state = localStorage.getItem("d1-manager:locked-state");
		if (saved_locked_state) {
			locked = JSON.parse(saved_locked_state);
		}
	});

	$: {
		localStorage.setItem("d1-manager:locked-state", JSON.stringify(locked));
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
			if (query_mode === "semantic") {
				const res = await fetch(`/api/db/${database}/assistant`, {
					method: "POST",
					body: JSON.stringify({
						t: table,
						q: query,
					}),
				});

				if (!res.ok) {
					throw new Error(await res.text());
				}

				const json = await res.json();
				const sql_to_run = json.sql;

				// now execute the query
				const query_res = await fetch(`/api/db/${database}/all`, {
					method: "POST",
					body: JSON.stringify({ query: sql_to_run }),
				});
				const query_json = await query_res.json();
				if (query_res.ok) {
					if ("results" in query_json) {
						result = query_json.results;
					} else {
						result = [];
					}
					last_run_sql = sql_to_run;
					is_custom_sql_result = true;
				} else {
					if ("message" in query_json) {
						throw new Error(query_json.message);
					}
					throw new Error("SQL query failed");
				}
			} else {
				// For raw SQL, execute the query directly
				const res = await fetch(`/api/db/${database}/all`, {
					method: "POST",
					body: JSON.stringify({ query }),
				});

				const json = await res.json();
				if (res.ok) {
					if ("results" in json) {
						result = json.results;
					} else {
						result = [];
					}
					last_run_sql = query;
					is_custom_sql_result = true;
				} else {
					if ("message" in json) {
						throw new Error(json.message);
					}
					throw new Error("SQL query failed");
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

	async function edit(rowid: unknown) {
		if (running) {
			return;
		}
		running = true;

		const record = result?.find((r) => r._ === rowid);

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

	$: columns =
		result && result.length > 0
			? Object.keys(result[0]).map((key) => {
					if (key === "_") {
						return;
					}

					const is_number = typeof result?.[0]?.[key] === "number";

					return table.createDataColumn(key, {
						header: () => key,
						meta: {
							is_number,
						},
						cell: (info) => {
							return createRender(TableCell, {
								value: info.getValue(),
								row: info.row,
								edit,
								locked,
								running,
								is_number,
								key,
								result,
							});
						},
					});
				})
			: [];

	$: tableData = result || [];

	const table = createTable({
		get data() {
			return tableData;
		},
		get columns() {
			return [
				...(columns || []).filter((c) => c),
				table.createDisplayColumn({
					id: "actions",
					cell: (info) => {
						return createRender(ActionsCell, {
							row: info.row,
							remove,
							locked,
							running,
						});
					},
				}),
			];
		},
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: (updater) => {
			const new_sorting_state =
				typeof updater === "function" ? updater(table.getState().sorting) : updater;

			if (new_sorting_state.length === 0) {
				order = "";
				dir = "ASC";
			} else {
				const [new_sort] = new_sorting_state;
				order = new_sort.id;
				dir = new_sort.desc ? "DESC" : "ASC";
			}

			run();
		},
	});
</script>

<div class="pt-4 pb-2">
	<div class="form-control w-52">
		<label class="label cursor-pointer">
			<span class="label-text">
				{$t(
					locked
						? "plugin.table-browser.table-is-locked"
						: "plugin.table-browser.table-is-unlocked",
				)}
			</span>
			<input type="checkbox" class="toggle toggle-primary" bind:checked={locked} />
		</label>
	</div>
</div>

<div class="tabs-boxed tabs mb-2 w-max bg-white/60 backdrop-blur-lg">
	<button
		class="tab"
		class:tab-active={query_mode === "semantic"}
		on:click={() => (query_mode = "semantic")}>Semantic</button
	>
	<button
		class="tab"
		class:tab-active={query_mode === "sql"}
		on:click={() => (query_mode = "sql")}>SQL</button
	>
</div>
<form class="form-control" on:submit|preventDefault={run_query}>
	<div class="input-group">
		<input
			type="text"
			placeholder={query_mode === "semantic"
				? "Enter a semantic query..."
				: "Enter an SQL query..."}
			class="input-bordered input w-full bg-white/60 backdrop-blur-lg"
			bind:value={query}
		/>
		<button
			type="submit"
			class="btn btn-primary shadow-md transition-all hover:shadow-lg"
			on:click={run_query}>Query</button
		>
	</div>
</form>

{#if last_run_sql}
	<div class="my-4">
		<p class="text-sm font-bold tracking-wider uppercase">Last Query</p>
		<div
			class="rounded-md border border-white/20 bg-white/60 p-2 font-mono text-sm backdrop-blur-lg"
		>
			{last_run_sql}
		</div>
	</div>
{/if}

{#if result}
	{#if result.length}
		<div
			class="max-h-[80vh] overflow-auto rounded-lg border border-white/20 bg-white/60 shadow backdrop-blur-lg transition-opacity"
			class:opacity-50={running}
		>
			<table class="table min-w-full">
				<thead class="bg-white/60 backdrop-blur-lg">
					{#each table.getHeaderGroups() as headerGroup}
						<tr>
							{#each headerGroup.headers as header}
								<th class="!relative normal-case">
									<button
										class="flex w-full items-center justify-between"
										on:click={header.column.getToggleSortingHandler()}
									>
										{#if !header.isPlaceholder}
											<svelte:component
												this={header.column.columnDef.header}
											/>
										{/if}
										{{
											asc: " 🔼",
											desc: " 🔽",
										}[header.column.getIsSorted() as string] ?? ""}
									</button>
								</th>
							{/each}
						</tr>
					{/each}
				</thead>
				<tbody>
					{#each table.getRowModel().rows as row}
						<tr class="group hover">
							{#each row.getVisibleCells() as cell}
								<td class="border">
									<svelte:component this={cell.render()} />
								</td>
							{/each}
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

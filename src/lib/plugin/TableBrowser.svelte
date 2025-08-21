<script lang="ts">
	import Icon from "@iconify/svelte";
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
	import { t } from "svelte-i18n";

	export let database: string;
	export let table: string;

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
		const saved_locked_state = localStorage.getItem("d1-manager:locked-state");
		if (saved_locked_state) {
			locked = JSON.parse(saved_locked_state);
		}
	});

	$: {
		localStorage.setItem("d1-manager:locked-state", JSON.stringify(locked));
	}

	$: if (browser && table) {
		result = undefined;
		run();
		offset = 0;
		order = "";
		dir = "ASC";
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
</script>

<div class="space-y-4">
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

	<div class="rounded-lg border border-gray-300 bg-white/60 p-4 shadow backdrop-blur-lg">
		<div class="tabs-boxed tabs mb-2 w-max">
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
	</div>

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
		{#if result.length > 0}
			<div
				class="max-h-[80vh] overflow-auto rounded-lg border border-gray-300 bg-white/60 shadow backdrop-blur-lg transition-opacity"
				class:opacity-50={running}
			>
				<table class="table-zebra min-w-full table-auto">
					<thead class="sticky top-0 bg-white/80 backdrop-blur-lg">
						<tr>
							{#each Object.keys(result[0] || {}) as col}
								{#if col !== "_"}
									<th
										class="relative cursor-pointer border border-gray-300 px-4 py-2 text-left text-xs font-medium tracking-wider uppercase select-none"
										on:click={() => change_sort(col)}
										title={col}
									>
										<div
											class="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-transparent to-white/50"
										></div>
										<div
											class="relative flex items-center justify-between gap-2"
										>
											<div class="truncate">
												{col}
											</div>
											{#if order === col && !is_custom_sql_result}
												<Icon
													icon={dir === "ASC"
														? "mdi:arrow-up"
														: "mdi:arrow-down"}
												/>
											{/if}
										</div>
									</th>
								{/if}
							{/each}
							<th class="border border-gray-300"></th>
						</tr>
					</thead>
					<tbody>
						{#each result as row}
							<tr class="group">
								{#each Object.entries(row) as [key, value]}
									{#if key !== "_"}
										<td class="border border-gray-300">
											{#if typeof value === "number"}
												<input
													class="input-ghost input input-xs hover:input-border w-full text-base transition-all disabled:bg-transparent"
													type="number"
													bind:value={row[key]}
													on:blur={() => edit(row._, key)}
													disabled={locked || running}
													title={locked
														? $t("plugin.table-browser.table-is-locked")
														: undefined}
												/>
											{:else}
												<input
													class="input-ghost input input-xs hover:input-border w-full text-base transition-all disabled:bg-transparent"
													bind:value={row[key]}
													on:change={() => edit(row._, key)}
													disabled={locked || running}
													title={locked
														? $t("plugin.table-browser.table-is-locked")
														: undefined}
												/>
											{/if}
										</td>
									{/if}
								{/each}
								<td
									class="border border-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
								>
									<button
										class="btn-outline btn-error btn-xs btn"
										on:click={() => remove(row._)}
										disabled={locked || running}
									>
										<Icon class="text-lg" icon="mdi:delete-outline" />
									</button>
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

		<div class="flex items-center justify-between pt-2">
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

			<p class="flex-grow text-center">
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
</div>

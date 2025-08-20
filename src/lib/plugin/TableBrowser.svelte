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
	});

	async function run() {
		if (running) {
			return;
		}
		running = true;

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
		} finally {
			running = false;
		}
	}

	async function run_query() {
		if (running) {
			return;
		}
		running = true;

		if (query_mode === "semantic") {
			const res = await fetch(`/api/db/${database}/assistant`, {
				method: "POST",
				body: JSON.stringify({
					table,
					query,
				}),
			});
			if (res.ok) {
				const sql = await res.text();
				where = sql;
				run();
			}
		} else {
			where = query;
			run();
		}
	}

	function change_sort(col: string) {
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
	<label class="swap">
		<input type="checkbox" bind:checked={locked} />
		<div class="swap-on flex items-center gap-2">
			<Icon icon="mdi:lock-outline" class="inline-block text-xl" />
			{$t("plugin.table-browser.table-is-locked-click-to-unlock")}
		</div>
		<div class="swap-off flex items-center gap-2">
			<Icon icon="mdi:lock-open-outline" class="inline-block text-xl" />
			{$t("plugin.table-browser.table-is-unlocked-click-to-lock")}
		</div>
	</label>
</div>

<div class="form-control">
	<div class="input-group">
		<input
			type="text"
			placeholder="Enter a semantic query..."
			class="input-bordered input w-full"
			bind:value={query}
			on:keydown={(e) => e.key === "Enter" && run_query()}
		/>
		<div class="tabs-boxed tabs">
			<a
				class="tab"
				class:tab-active={query_mode === "semantic"}
				on:click={() => (query_mode = "semantic")}>Semantic</a
			>
			<a class="tab" class:tab-active={query_mode === "sql"} on:click={() => (query_mode = "sql")}
				>SQL</a
			>
		</div>
	</div>
</div>

{#if result}
	{#if result.length}
		<div class="max-h-[80vh] overflow-auto transition-opacity" class:opacity-50={running}>
			<table class="table-sm table min-w-full">
				<thead>
					<tr class="bg-base-200 sticky top-0 z-10 shadow">
						{#each cols as col}
							<th
								class="!relative cursor-pointer normal-case"
								on:click={() => change_sort(col)}
								title={$t("plugin.table-browser.click-to-sort-by", {
									values: { col },
								})}
							>
								{col}
								{#if order === col}
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
									<td>
										{#if typeof row[key] === "number"}
											<input
												class="input-ghost input input-xs hover:input-border text-base transition-all disabled:bg-transparent"
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
												class="input-ghost input input-xs hover:input-border text-base transition-all disabled:bg-transparent"
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
							<td>
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
		{#if offset > 0}
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

		{#if result.length === limit}
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

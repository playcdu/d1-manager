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

<div class="space-y-4">
	<div class="flex justify-between items-center">
		<div class="form-control">
			<label class="label cursor-pointer gap-2">
				<span class="label-text">{$t("read-only")}</span>
				<input type="checkbox" class="toggle toggle-sm" bind:checked={locked} />
			</label>
		</div>
		{#if running}
			<span class="loading loading-spinner"></span>
		{/if}
	</div>

	{#if result}
		{#if result.length}
			<div class="overflow-x-auto">
				<table class="table table-zebra table-sm w-full">
					<thead>
						<tr>
							{#each cols as col}
								<th class="cursor-pointer" on:click={() => change_sort(col)}>
									{col}
									{#if order === col}
										<Icon
											icon={dir === "ASC" ? "mdi:arrow-up" : "mdi:arrow-down"}
											class="inline-block"
										/>
									{/if}
								</th>
							{/each}
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each result as row}
							<tr>
								{#each Object.keys(row) as key}
									{#if key !== "_"}
										<td>
											{#if typeof row[key] === "number"}
												<input
													class="input input-ghost input-sm w-full"
													type="number"
													bind:value={row[key]}
													on:blur={() => edit(row._, key)}
													disabled={locked || running}
												/>
											{:else}
												<input
													class="input input-ghost input-sm w-full"
													bind:value={row[key]}
													on:change={() => edit(row._, key)}
													disabled={locked || running}
												/>
											{/if}
										</td>
									{/if}
								{/each}
								<td>
									<button
										class="btn btn-ghost btn-xs"
										on:click={() => remove(row._)}
										disabled={locked || running}
									>
										<Icon icon="mdi:delete-outline" class="text-lg" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="join grid grid-cols-2">
				<button
					class="join-item btn btn-outline"
					disabled={offset === 0 || running}
					on:click={() => {
						offset -= limit;
						run();
					}}
				>
					{$t("plugin.table-browser.prev")}
				</button>
				<button
					class="join-item btn btn-outline"
					disabled={result.length < limit || running}
					on:click={() => {
						offset += limit;
						run();
					}}
				>
					{$t("plugin.table-browser.next")}
				</button>
			</div>
		{:else}
			<p>{$t("plugin.table-browser.no-results")}</p>
		{/if}
	{/if}

	{#if error}
		<div class="alert alert-error">
			<div>{error.error.cause || error.error.message}</div>
		</div>
	{/if}
</div>

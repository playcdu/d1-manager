<script lang="ts">
	import { t } from "svelte-i18n";
	import type { PluginData } from "./type";
	import { z } from "zod";

	export let database: string;
	export let table: string;
	export let data: PluginData;

	const cols = data.db
		.find(({ name }) => name === table)
		?.columns.sort(({ cid: a }, { cid: b }) => a - b);
	if (!cols) {
		throw new Error(`Table not found: ${table} in ${database}`);
	}
	let record = Object.fromEntries<{ type: string; val: string; err: string; nullable: boolean }>(
		cols.map(({ name, type, dflt_value, notnull }) => [
			name,
			{
				type,
				val: dflt_value ?? "",
				err: type_check(type, dflt_value ?? ""),
				nullable: !!notnull,
			},
		]),
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
	let error:
		| {
				error: {
					message: string;
					cause?: string;
				};
		  }
		| undefined;
	async function add() {
		if (running) {
			return;
		}
		running = true;
		const data = Object.fromEntries(
			Object.entries(record)
				.map(([key, { type, val, nullable }]) => {
					switch (type) {
						case "INTEGER":
							return [key, val ? val : undefined];
						case "TEXT":
							return [key, nullable ? (val ? val : undefined) : val];
						case "REAL":
							return [key, nullable ? (val ? val : undefined) : val];
						case "BLOB":
							return [key, val ? val : undefined];
						default:
							return [key, val];
					}
				})
				.filter(([_, val]) => val !== undefined),
		);
		try {
			const res = await fetch(`/api/db/${database}/${table}/data`, {
				method: "POST",
				body: JSON.stringify(data),
			});
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
				throw new Error($t("plugin.run-query.no-result"));
			}
		} catch (err) {
			error = {
				error: {
					message:
						err instanceof Error ? err.message : $t("plugin.run-query.unknown-error"),
				},
			};
			result = undefined;
		} finally {
			running = false;
		}
	}
	function input_type(type: string): string {
		switch (type) {
			case "INTEGER":
				return "number";
			case "TEXT":
				return "text";
			case "REAL":
				return "number";
			case "BLOB":
				return "file";
			default:
				return "text";
		}
	}
	function type_check(type: string, val: string): string {
		try {
			switch (type) {
				case "INTEGER":
					z.string()
						.regex(/^\d*$/, $t("plugin.add-record.integer-is-required"))
						.parse(val);
					break;
				case "TEXT":
					z.string().parse(val);
					break;
				case "REAL":
					z.string()
						.regex(/^\d*(\.\d+)?$/, $t("plugin.add-record.real-is-required"))
						.parse(val);
					break;
				case "BLOB":
					return "File upload not supported yet";
				default:
					return "";
			}
		} catch (err) {
			if (err instanceof z.ZodError) {
				return err.issues[0].message;
			} else {
				return "Unknown error";
			}
		}
		return "";
	}
</script>

<div class="space-y-4">
	<form on:submit|preventDefault={add}>
		{#each cols as col}
			<div class="form-control">
				<label class="label" for="col-{col.name}">
					<span class="label-text">{col.name}</span>
				</label>
				{#if input_type(col.type) !== "file"}
					<input
						id="col-{col.name}"
						class="input input-bordered"
						class:input-error={record[col.name].err}
						type={input_type(col.type)}
						on:input={(e) => {
							const err = type_check(col.type, e.currentTarget.value);
							record[col.name] = {
								type: col.type,
								val: e.currentTarget.value,
								err,
								nullable: !!col.notnull,
							};
						}}
						placeholder={col.dflt_value || ""}
						disabled={running}
					/>
					{#if record[col.name].err}
						<label class="label" for="col-{col.name}">
							<span class="label-text-alt text-error">{record[col.name].err}</span>
						</label>
					{/if}
				{:else}
					<span class="text-error">{$t("plugin.add-record.file-upload-not-supported")}</span>
				{/if}
			</div>
		{/each}

		<div class="flex justify-end mt-4">
			<button type="submit" class="btn btn-primary" disabled={running}>
				{#if running}
					<span class="loading loading-spinner"></span>
				{/if}
				{$t("plugin.add-record.add")}
			</button>
		</div>
	</form>

	{#if result}
		<div class="alert alert-success">
			<h3>{$t("plugin.add-record.success")}</h3>
			<p class="text-sm">
				{$t("plugin.add-record.n-ms", {
					values: {
						n: result.meta.duration.toFixed(2),
					},
				})}
			</p>
		</div>
	{:else if error}
		<div class="alert alert-error">
			<h3>{$t("plugin.add-record.error")}</h3>
			<p>{error.error.cause || error.error.message}</p>
		</div>
	{/if}
</div>

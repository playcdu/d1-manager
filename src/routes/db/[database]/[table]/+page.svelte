<script lang="ts">
	import { page } from "$app/stores";
	import { t } from "svelte-i18n";
	import type { PageData } from "./$types";
	import { onMount } from "svelte";

	export let data: PageData;
	const meta = data.db.find((table) => table.name === $page.params.table);
	if (!meta) {
		throw new Error(`Table not found: ${$page.params.table} in ${$page.params.database}`);
	}

	const plugins = {
		["table-browser"]: () => import("$lib/plugin/TableBrowser.svelte"),
		["run-query"]: () => import("$lib/plugin/RunQuery.svelte"),
		["semantic-query"]: () => import("$lib/plugin/SemanticQuery.svelte"),
		["add-record"]: () => import("$lib/plugin/AddRecord.svelte"),
		["csv"]: () => import("$lib/plugin/CSV.svelte"),
	};

	let plugin: keyof typeof plugins = "table-browser";
	let PluginComponent: ConstructorOfATypedSvelteComponent | undefined;

	function loadPlugin(p: keyof typeof plugins) {
		plugin = p;
		plugins[plugin]().then((m) => {
			PluginComponent = m.default;
		});
	}

	onMount(() => {
		loadPlugin("table-browser");
	});
</script>

<svelte:head>
	<title>{$page.params.table} @ {$page.params.database} | {$t("d1-manager.name")}</title>
	<meta
		name="description"
		content={$t("d1-manager-manage-db", { values: { db: $page.params.table } })}
	/>
</svelte:head>

<div class="space-y-4">
	<h1 class="text-2xl font-bold">{meta.name}</h1>

	<div class="overflow-x-auto">
		<table class="table table-zebra table-sm">
			<thead>
				<tr>
					<th>{$t("col-name")}</th>
					<th>{$t("col-type")}</th>
					<th>{$t("col-default")}</th>
				</tr>
			</thead>
			<tbody>
				{#each meta.columns as column}
					<tr class:font-bold={column.pk}>
						<td>{column.name}</td>
						<td>{column.type}</td>
						<td>{column.dflt_value}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="tabs tabs-boxed">
		{#each Object.keys(plugins) as name}
			<a
				class="tab"
				class:tab-active={plugin === name}
				on:click={() => loadPlugin(name as keyof typeof plugins)}>{$t(`plugin.${name}.name`)}</a
			>
		{/each}
	</div>

	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			{#if PluginComponent}
				<svelte:component
					this={PluginComponent}
					{data}
					database={$page.params.database}
					table={$page.params.table}
				/>
			{/if}
		</div>
	</div>
</div>

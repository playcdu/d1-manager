<script lang="ts">
	import { page } from "$app/stores";
	import { t } from "svelte-i18n";
	import type { PageData } from "./$types";

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

	let plugin: keyof typeof plugins | undefined = "table-browser";
	let PluginComponent: ConstructorOfATypedSvelteComponent | undefined;
	$: {
		if (plugin) {
			plugins[plugin]().then((m) => {
				PluginComponent = m.default;
			});
		}
	}

	function preload_plugins() {
		Object.values(plugins).forEach((importer) => {
			importer();
		});
	}
</script>

<svelte:head>
	<title>{$page.params.table} @ {$page.params.database} | Craft Down Under</title>
	<meta
		name="description"
		content="Manage the {$page.params.table} table in the {$page.params.database} database."
	/>
</svelte:head>

<div class="flex w-full flex-col items-center justify-start gap-4">
	<div
		class="card w-full border border-white border-opacity-20 bg-white bg-opacity-10 shadow-lg backdrop-blur-lg"
	>
		<div class="card-body">
			<div role="tablist" class="tabs-lifted tabs">
				{#each Object.keys(plugins) as name}
					<button
						role="tab"
						class="tab"
						class:tab-active={plugin === name}
						on:click={() => (plugin = name)}
					>
						{$t(`plugin.${name}.name`)}
					</button>
				{/each}
			</div>

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

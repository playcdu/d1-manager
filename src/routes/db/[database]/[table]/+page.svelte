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

<div class="rounded-lg border border-gray-300 bg-white/60 shadow backdrop-blur-lg">
	<div class="border-b border-gray-200 p-4">
		<nav class="-mb-px flex gap-6">
			{#each Object.keys(plugins) as name}
				<button
					class="border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap"
					class:border-blue-500={plugin === name}
					class:text-blue-600={plugin === name}
					class:border-transparent={plugin !== name}
					class:text-gray-500={plugin !== name}
					class:hover:border-gray-300={plugin !== name}
					class:hover:text-gray-700={plugin !== name}
					on:click={() => (plugin = name)}
				>
					{$t(`plugin.${name}.name`)}
				</button>
			{/each}
		</nav>
	</div>

	<div class="p-4">
		{#if PluginComponent}
			<svelte:component
				this={PluginComponent}
				database={$page.params.database}
				table={$page.params.table}
			/>
		{/if}
	</div>
</div>

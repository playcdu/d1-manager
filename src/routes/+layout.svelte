<script lang="ts">
	import { browser } from "$app/environment";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { get } from "$lib/storage";
	import { onMount } from "svelte";
	import { locale, t } from "svelte-i18n";
	import { writable } from "svelte/store";
	import "../app.css";
	import type { LayoutData } from "./$types";
	import { preloadData } from "$app/navigation";
	import type { PluginData } from '$lib/plugin/type';

	export let data: LayoutData;
	let tables: PluginData["db"] = [];

	async function fetch_tables() {
		if ($page.params.database) {
			const res = await fetch(`/api/db/${$page.params.database}`);
			if (res.ok) {
				tables = await res.json();
			}
		} else {
			tables = [];
		}
	}

	$: $page.params.database, browser && fetch_tables();

	let lang = writable<string | null | undefined>(undefined);

	onMount(() => {
		lang = get("lang", {
			default_value: window.navigator.language,
			ttl: 30 * 24 * 60 * 60 * 1000,
		});
		lang.subscribe((value) => {
			if (value) {
				locale.set(value);
			}
		});
	});

	function preload() {
		if (data.dbms.length > 1) {
			preloadData(`/db/${data.dbms[0]}`);
		}
	}
</script>

<svelte:head>
	<title>Craft Down Under D1 Manager</title>
</svelte:head>

<div class="grid h-dvh w-full grid-cols-[320px_1fr] bg-gray-100 text-gray-800">
	<!-- Sidebar -->
	<div class="flex-shrink-0 bg-gray-800 text-white">
		<div class="flex h-full flex-col">
			<div class="flex h-16 flex-shrink-0 items-center justify-center bg-gray-900 px-4">
				<a class="flex items-center text-xl font-semibold" href="/">
					<img
						src="https://cdn.playcdu.co/Images/Branding/Blue/BH_NU_Asset_6.png"
						alt="Craft Down Under Logo"
						class="mr-2 h-8"
					/>
					<span>Craft Down Under D1 Manager</span>
				</a>
			</div>
			<div class="flex-1 overflow-y-auto p-4">
				<h2 class="mb-2 text-sm font-bold uppercase tracking-wider text-gray-400">Databases</h2>
				<div class="flex flex-col gap-2">
					{#each data.dbms as db}
						<a
							href="/db/{db}"
							class="rounded-md px-4 py-2 text-left"
							class:bg-gray-700={$page.params.database === db}
							>{db}</a
						>
					{/each}
				</div>
				<hr class="my-4 border-gray-700" />
				<h2 class="mb-2 text-sm font-bold uppercase tracking-wider text-gray-400">Tables</h2>
				{#if tables.length > 0}
					<div class="flex flex-col gap-2">
						{#each tables as table}
							<a
								href={`/db/${$page.params.database}/${table.name}`}
								class="rounded-md px-4 py-2"
								class:bg-gray-700={$page.params.table === table.name}
							>
								{table.name}
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Main content -->
	<div class="flex flex-col overflow-hidden">
		<div class="flex-1 overflow-y-auto bg-gradient-to-br from-blue-50 via-white to-blue-50 p-8">
			<slot />
		</div>
	</div>
</div>

<script lang="ts">
	import { browser } from "$app/environment";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { get } from "$lib/storage";
	import { onMount } from "svelte";
	import { locale, t } from "svelte-i18n";
	import { writable } from "svelte/store";
	import { themeChange } from "theme-change";
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
		themeChange(false);
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

<div class="drawer lg:drawer-open">
	<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex flex-col items-center justify-center">
		<div
			class="navbar min-h-12 w-full border-b border-white border-opacity-20 bg-white bg-opacity-10 shadow-lg backdrop-blur-lg"
		>
			<div class="flex-1">
				<a class="btn-ghost btn-sm btn text-xl normal-case" href="/"
					>Craft Down Under D1 Manager</a
				>
			</div>
			<div class="flex-none">
				<label for="my-drawer-2" class="btn-primary drawer-button btn lg:hidden">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h7"
						/>
					</svg>
				</label>
			</div>
		</div>
		<div class="p-4">
			<h2 class="mb-2 text-sm font-bold uppercase tracking-wider">Databases</h2>
			<div class="btn-group">
				{#each data.dbms as db}
					<a href="/db/{db}" class="btn" class:btn-active={$page.params.database === db}>{db}</a>
				{/each}
			</div>
		</div>
		<div class="w-full flex-1 overflow-y-auto px-4 pb-4">
			<slot />
		</div>
	</div>
	<div class="drawer-side">
		<label for="my-drawer-2" class="drawer-overlay"></label>
		<ul
			class="menu min-h-full w-80 border-r border-white border-opacity-20 bg-white bg-opacity-10 p-4 text-base-content backdrop-blur-lg"
		>
			<!-- Sidebar content here -->
			<li class="menu-title">{$t('tables')}</li>
			{#if tables.length > 0}
				{#each tables as table}
					<li>
						<a
							href={`/db/${$page.params.database}/${table.name}`}
							class:active={$page.params.table === table.name}
						>
							{table.name}
						</a>
					</li>
				{/each}
			{/if}
			<div class="grow"></div>
			<li>
				<label class="swap swap-rotate">
					<input type="checkbox" data-toggle-theme="dark,light" />
					<div class="swap-on">THEME</div>
					<div class="swap-off">THEME</div>
				</label>
			</li>
		</ul>
	</div>
</div>

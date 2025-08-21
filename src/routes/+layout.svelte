<script lang="ts">
	import { browser } from "$app/environment";
	import { goto, preloadData } from "$app/navigation";
	import { page } from "$app/stores";
	import { get } from "$lib/storage";
	import { onMount } from "svelte";
	import { locale, t } from "svelte-i18n";
	import { writable } from "svelte/store";
	import "../app.css";
	import type { LayoutData } from "./$types";
	import Icon from "@iconify/svelte";

	export let data: LayoutData;

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

<div class="grid h-dvh w-full grid-cols-[280px_1fr] bg-gray-100 font-sans text-gray-800">
	<!-- Sidebar -->
	<div class="flex flex-col border-r border-white/20 bg-gray-800/80 text-white backdrop-blur-lg">
		<div class="flex h-20 flex-shrink-0 items-center gap-4 px-6">
			<img
				src="https://cdn.playcdu.co/Images/Branding/Blue/BH_NU_Asset_6.png"
				alt="Craft Down Under Logo"
				class="h-10"
			/>
			<span class="text-xl font-semibold">D1 Manager</span>
		</div>
		<div class="flex-1 overflow-y-auto p-4">
			<nav class="flex flex-col gap-4">
				<div>
					<h2 class="mb-2 text-sm font-bold tracking-wider text-gray-400 uppercase">
						Databases
					</h2>
					<div class="flex flex-col gap-1">
						{#each data.dbms as db}
							<a
								href="/db/{db}"
								class="flex items-center gap-3 rounded-md px-4 py-2 text-left transition-colors"
								class:bg-blue-500={$page.params.database === db}
								class:hover:bg-gray-700={$page.params.database !== db}
							>
								<Icon icon="mdi:database-outline" class="text-xl" />
								<span>{db}</span></a
							>
						{/each}
					</div>
				</div>
				<hr class="border-gray-700" />
				{#if $page.data.db}
					<div>
						<h2 class="mb-2 text-sm font-bold tracking-wider text-gray-400 uppercase">
							Tables
						</h2>
						<div class="flex flex-col gap-1">
							{#each $page.data.db as table}
								<a
									href={`/db/${$page.params.database}/${table.name}`}
									class="flex items-center gap-3 rounded-md px-4 py-2 transition-colors"
									class:bg-blue-500={$page.params.table === table.name}
									class:hover:bg-gray-700={$page.params.table !== table.name}
								>
									<Icon icon="mdi:table" class="text-xl" />
									<span>{table.name}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</nav>
		</div>
	</div>

	<!-- Main content -->
	<div class="flex flex-col overflow-hidden">
		<div
			class="bg-grid-slate-100 flex-1 overflow-y-auto p-8"
			style="background-image: radial-gradient(circle, rgba(255, 255, 255, 0.2) 1px, transparent 1px); background-size: 20px 20px;"
		>
			<slot />
		</div>
	</div>
</div>

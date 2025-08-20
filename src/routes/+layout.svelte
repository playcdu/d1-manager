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
	import Sidebar from "$lib/components/Sidebar.svelte";

	export let data: LayoutData;
	let database = $page.params.database || "";
	$: {
		if (browser && database && database !== $page.params.database) {
			goto(`/db/${database}`);
		}
	}

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
</script>

<div class="drawer drawer-open">
	<input id="sidebar" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex flex-col items-stretch">
		<div class="navbar bg-base-100/80 min-h-12 backdrop-blur">
			<div class="flex-none">
				<label for="sidebar" class="btn btn-square btn-ghost lg:hidden">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="inline-block w-5 h-5 stroke-current"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						></path></svg
					>
				</label>
			</div>
			<div class="flex-1">
				<a
					class="btn-ghost btn-sm btn text-xl normal-case"
					href="/"
					on:click={() => (database = "")}>D1 Manager</a
				>
			</div>
			<div class="flex-none">
				<select class="select select-bordered select-sm" bind:value={database}>
					<option value="" disabled selected>{$t("select-database")}</option>
					{#each data.dbms as db}
						<option value={db}>{db}</option>
					{/each}
				</select>
			</div>
		</div>
		<div class="flex-1 overflow-y-auto p-4">
			<slot />
		</div>
	</div>
	<div class="drawer-side">
		<label for="sidebar" class="drawer-overlay"></label>
		<Sidebar tables={data.tables} />
	</div>
</div>

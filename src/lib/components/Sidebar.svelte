<script lang="ts">
	import { page } from "$app/stores";
	import type { Table } from "$lib/server/db/dbms";
	import { t } from "svelte-i18n";
	export let tables: Table[] = [];
</script>

<ul class="menu p-4 w-80 min-h-full bg-base-200 text-base-content flex flex-col">
	<li class="menu-title">{$t("tables")}</li>
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
	<div class="flex-1"></div>
	<li>
		<label class="swap swap-rotate">
			<input type="checkbox" data-toggle-theme="dark,light" />
			<div class="swap-on">THEME</div>
			<div class="swap-off">THEME</div>
		</label>
	</li>
</ul>

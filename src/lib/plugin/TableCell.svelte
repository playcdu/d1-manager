<script lang="ts">
	import { t } from 'svelte-i18n';

	export let value: unknown;
	export let row: any;
	export let column: any;
	export let table: any;

	export let edit: (rowid: unknown) => void;
	export let locked: boolean;
	export let running: boolean;
	export let is_number: boolean;
	export let key: string;
	export let result: any[];

	const onchange = (e: Event) => {
		const target = e.target as HTMLInputElement;
		value = target.value;
		result[row.index][key] = is_number ? Number(value) : value;
		edit(row.original._);
	};
</script>

<input
	class="input-ghost input input-xs w-full hover:input-border text-base transition-all disabled:bg-transparent"
	type={is_number ? 'number' : 'text'}
	{value}
	on:change={onchange}
	disabled={locked || running}
	title={locked ? $t('plugin.table-browser.table-is-locked') : undefined}
/>

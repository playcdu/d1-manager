<script lang="ts">
	import Icon from '@iconify/svelte';

	export let row: any;
	export let remove: (rowid: unknown) => void;
	export let locked: boolean;
	export let running: boolean;

	const onclick = () => remove(row.original._);
</script>

<button
	class="btn-outline btn-error btn-xs btn"
	on:click={onclick}
	disabled={locked || running}
>
	<Icon class="text-lg" icon="mdi:delete-outline" />
</button>

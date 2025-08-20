<script lang="ts">
	import { onMount } from "svelte";
	import { t, locales } from "svelte-i18n";
	import { themeChange } from "theme-change";
	import { get } from "$lib/storage";
	import { writable } from "svelte/store";

	const themes = [
		"light",
		"dark",
		"cupcake",
		"bumblebee",
		"emerald",
		"corporate",
		"synthwave",
		"retro",
		"cyberpunk",
		"valentine",
		"halloween",
		"garden",
		"forest",
		"aqua",
		"lofi",
		"pastel",
		"fantasy",
		"wireframe",
		"black",
		"luxury",
		"dracula",
		"cmyk",
		"autumn",
		"business",
		"acid",
		"lemonade",
		"night",
		"coffee",
		"winter",
	];

	let lang = writable<string | null | undefined>(undefined);

	onMount(() => {
		themeChange(false);
		lang = get("lang", {
			default_value: window.navigator.language,
			ttl: 30 * 24 * 60 * 60 * 1000,
		});
	});
</script>

<svelte:head>
	<title>{$t("d1-manager.name")}</title>
	<meta name="description" content={$t("d1-manager.description")} />
</svelte:head>

<div
	class="hero min-h-full"
	style="background-image: url(https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D);"
>
	<div class="hero-overlay bg-opacity-60"></div>
	<div class="hero-content text-center text-neutral-content">
		<div class="max-w-md">
			<h1 class="mb-5 text-5xl font-bold">{$t("d1-manager.name")}</h1>
			<p class="mb-5">
				{$t("d1-manager.description")}
			</p>

			<div class="flex justify-center gap-4">
				<div class="w-full max-w-xs">
					<label class="label" for="theme-select">
						<span class="label-text text-neutral-content">{$t("theme")}</span>
					</label>
					<select data-choose-theme id="theme-select" class="select-accent select w-full">
						{#each themes as theme}
							<option value={theme}>{theme}</option>
						{/each}
					</select>
				</div>

				<div class="w-full max-w-xs">
					<label class="label" for="language-select">
						<span class="label-text text-neutral-content">{$t("language")}</span>
					</label>
					<select id="language-select" class="select-accent select w-full" bind:value={$lang}>
						{#each $locales as lang}
							<option value={lang}>{$t(`lang.${lang}`)}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>
	</div>
</div>

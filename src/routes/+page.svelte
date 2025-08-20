<script lang="ts">
	import { t, locales } from "svelte-i18n";
	import { get } from "$lib/storage";
	import { writable } from "svelte/store";

	let lang = get("lang", {
		default_value: window.navigator.language,
		ttl: 30 * 24 * 60 * 60 * 1000,
	});
</script>

<svelte:head>
	<title>{$t("d1-manager.name")}</title>
	<meta name="description" content={$t("d1-manager.description")} />
</svelte:head>

<div class="hero min-h-full bg-base-200">
	<div class="hero-content text-center">
		<div class="max-w-md">
			<h1 class="text-5xl font-bold">{$t("d1-manager.name")}</h1>
			<p class="py-6">
				{$t("d1-manager.description")}
			</p>
			<div class="form-control w-full max-w-xs mx-auto">
				<label class="label" for="language-select">
					<span class="label-text">{$t("language")}</span>
				</label>
				<select id="language-select" class="select select-bordered" bind:value={$lang}>
					{#each $locales as lang}
						<option value={lang}>{$t(`lang.${lang}`)}</option>
					{/each}
				</select>
			</div>
			<div class="mt-8">
				<a
					href="https://github.com/JacobLinCool/d1-manager"
					target="_blank"
					rel="noreferrer"
					class="link"
				>
					{$t("see-github")}
				</a>
			</div>
		</div>
	</div>
</div>

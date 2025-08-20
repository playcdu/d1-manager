<script lang="ts">
	import { page } from "$app/stores";
	import { t } from "svelte-i18n";
	import type { LayoutData } from "./$types";
	import { sqlite2sql } from "$lib/sqlite2sql";
	import { invalidateAll } from "$app/navigation";

	async function import_db() {
		const file = document.createElement("input");
		file.type = "file";
		file.accept = ".sqlite3,.sqlite,.db,.sql";
		file.onchange = async () => {
			if (file.files?.length !== 1) {
				return;
			}

			const db = file.files[0];
			let sql: string;
			if (db.name.endsWith(".sql")) {
				sql = await db.text();
			} else {
				sql = await sqlite2sql(await db.arrayBuffer());
			}

			console.log(sql);

			const res = await fetch(`/api/db/${$page.params.database}/exec`, {
				method: "POST",
				body: JSON.stringify({ query: sql }),
			});

			if (res.ok) {
				await invalidateAll();
			} else {
				alert(await res.text());
			}

			file.remove();
		};
		file.click();
	}
</script>

<slot />

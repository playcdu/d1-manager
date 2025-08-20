import { available } from "$lib/server/ai";
import type { LayoutServerLoad } from "./$types";
import type { Table } from "$lib/server/db/dbms";

export const load: LayoutServerLoad = async ({ fetch, params }) => {
	const dbms = await fetch("/api/db").then((r) => r.json<string[]>());
	const assistant = available();
	const database = params.database;
	let tables: Table[] = [];
	if (database) {
		tables = await fetch(`/api/db/${database}`).then((r) => r.json<Table[]>());
	}
	return { dbms, assistant, tables };
};

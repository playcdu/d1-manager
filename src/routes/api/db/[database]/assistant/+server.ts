import { select_backend } from "$lib/server/ai";
import { json } from "@sveltejs/kit";
import { z } from "zod";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request, fetch, platform }) => {
	const aid = await select_backend();
	if (!aid) {
		return json({
			error: "no backend",
		});
	}

	const tables_p = fetch("/api/db/" + params.database).then((r) =>
		r.json<
			{
				name: string;
				columns: { name: string; type: string }[];
				count: number;
			}[]
		>(),
	);

	const data = await request.json<{
		q: string;
		t?: string;
	}>();

	const tables = await tables_p;

	// if t is provided, swap the table t with the first table
	if (data.t) {
		const i = tables.findIndex(({ name }) => name === data.t);
		if (i > 0) {
			[tables[0], tables[i]] = [tables[i], tables[0]];
		}
	}

	const question = data.q || "show first 10 records in the table";

	const system = `SQLite tables, with their properties:

${tables
			.map(
				({ name, columns }) =>
					`${name} (${columns.map(({ name, type }) => `${name}: ${type}`).join(", ")})`,
			).join("\n")}

IMPORTANT SAFETY RULES:
- NEVER generate DELETE, DROP, ALTER, or any other destructive SQL that could lose data
- INSERT and UPDATE operations are acceptable and safe
- If the user asks for destructive operations like deleting tables/databases, return a SELECT statement that explains why it's blocked
- Only block operations that could destroy data structure or lose data permanently

Examples of safe responses:
- For "delete table users": SELECT 'Operation blocked for safety: Cannot delete tables' as message
- For "drop database": SELECT 'Operation blocked for safety: Cannot drop databases' as message
- For "insert new user": Generate normal INSERT statement (this is safe)
- For "update user email": Generate normal UPDATE statement (this is safe)

write a raw SQL, without comment`;

	const get_sql = aid.task(
		system,
		z.object({
			sql: z.string().describe("SQL query"),
		}),
		{
			examples: [
				[
					{ text: "show first 10 records in the table" },
					{ sql: `SELECT * FROM \`${tables[0].name}\` LIMIT 10` },
				],
				[
					{ text: "show columns in the table" },
					{
						sql: `SELECT name, type FROM pragma_table_info('${tables[0].name}')`,
					},
				],
			],
		},
	);

	const { result } = await get_sql(question);

	return json({
		sql: result.sql,
	});
};

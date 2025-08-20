import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
    const { db } = await parent();
    if (db && db.length > 0) {
        const [firstTable] = db;
        throw redirect(307, `/db/${params.database}/${firstTable.name}`);
    }
    return {};
};

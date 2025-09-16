import {
    Spreadsheet,
    SpreadsheetColumn
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import {
    FlexibleGridCell
} from "./types"
import { aesDecrypt } from "../crypto/encdcrpt";

export async function decrypt_and_adapt_spreadsheet(spreadsheet: Spreadsheet, fnKD: Uint8Array<ArrayBufferLike>) {
    const flexible_grid_cells : FlexibleGridCell[] = (
        await Promise.all(spreadsheet.columns.map(async ([x, column]) => {
            return await Promise.all(column.rows.map(async ([y, cell]) => {
                const str_val = Buffer.from(cell).toString();
                const value = await aesDecrypt(str_val, fnKD);
                
                return { key: { col : x, row: y }, value};
            }))
        }))
    ).flat();

    return flexible_grid_cells;
}
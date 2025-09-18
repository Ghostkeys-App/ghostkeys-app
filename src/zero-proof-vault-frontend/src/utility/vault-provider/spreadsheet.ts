import {
    Spreadsheet
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import {
    FlexibleGridCell,
    ICGridColumns,
    ICGridColumnsArray,
    FlexibleGridColumn
} from "./types"
import { aesDecrypt, aesEncrypt } from "../crypto/encdcrpt";
import { FlexGridColumns, serializeSpreadsheet, serializeSpreadsheetColumns, SpreadsheetMap } from "@ghostkeys/ghostkeys-sdk";

export async function decrypt_and_adapt_spreadsheet(spreadsheet: Spreadsheet, fnKD: Uint8Array<ArrayBufferLike>) {
    const flexible_grid_cells: FlexibleGridCell[] = (
        await Promise.all(spreadsheet.columns.map(async ([x, column]) => {
            return await Promise.all(column.rows.map(async ([y, cell]) => {
                const str_val = Buffer.from(cell).toString();
                const value = await aesDecrypt(str_val, fnKD);

                return { key: { col: x, row: y }, value };
            }))
        }))
    ).flat();

    return flexible_grid_cells;
}

export async function decrypt_and_adapt_columns(columns: ICGridColumns, fnKD: Uint8Array<ArrayBufferLike>) {
    let columns_array: ICGridColumnsArray = Object.entries(columns) as ICGridColumnsArray;
    const flexible_grid_columns: FlexibleGridColumn[] = (
        await Promise.all(columns_array.map(async ([index, column]) => {
            let name = await aesDecrypt(Buffer.from(column[0]).toString(), fnKD);
            let hidden: boolean = column[1];
            return { name, meta: { index, hidden } };
        }))
    )
    return flexible_grid_columns;
}

export async function encryptSpreadsheetColumns(gridColumns: FlexibleGridColumn[], fnKD: Uint8Array): Promise<FlexGridColumns> {
    const flexGridColumnsBeforeSer: FlexGridColumns = {};
    for (const entry of gridColumns) {
        const encryptedName = await aesEncrypt(entry.name, fnKD);
        const index = entry.meta.index;
        const hidden = !!entry?.meta?.hidden;
        flexGridColumnsBeforeSer[index] = { name: encryptedName, hidden };
    }
    return flexGridColumnsBeforeSer;
}

export async function encryptAndSerializeSpreadsheetColumn(gridColumns: FlexibleGridColumn[], fnKD: Uint8Array): Promise<Uint8Array<ArrayBufferLike>> {
    const flexGridColumnsBeforeSer = await encryptSpreadsheetColumns(gridColumns, fnKD);
    const serializedCL = serializeSpreadsheetColumns(flexGridColumnsBeforeSer);
    return serializedCL;
}

export async function encryptSpreadsheet(gridCells: FlexibleGridCell[], fnKD: Uint8Array): Promise<SpreadsheetMap> {
    const flexGridBeforeSer: SpreadsheetMap = {};
    let tempFlexCell: { [y: number]: string } = {};
    for (const entry of gridCells) {
        const encryptedName = await aesEncrypt(entry.value, fnKD);
        const index = entry.key.col;
        tempFlexCell[entry.key.row] = encryptedName;
        flexGridBeforeSer[index] = tempFlexCell;
        tempFlexCell = {};
    }
    return flexGridBeforeSer;
}

export async function encryptAndSerializeSpreadsheet(gridCells: FlexibleGridCell[], fnKD: Uint8Array): Promise<Uint8Array<ArrayBufferLike>> {
    const flexGridBeforeSer = await encryptSpreadsheet(gridCells, fnKD);
    const serializedS = serializeSpreadsheet(flexGridBeforeSer);
    return serializedS;
}
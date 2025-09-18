import {
    Spreadsheet
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import {
    FlexibleGridCell,
    ICGridColumns,
    FlexibleGridColumn,
    FlexGridDataKey
} from "./types"
import { aesDecrypt, aesEncrypt } from "../crypto/encdcrpt";
import { FlexGridColumns, serializeSpreadsheet, serializeSpreadsheetColumns, SpreadsheetMap } from "@ghostkeys/ghostkeys-sdk";

export async function decrypt_and_adapt_spreadsheet(spreadsheet: Spreadsheet, fnKD: Uint8Array<ArrayBufferLike>): Promise<FlexibleGridCell[]> {
    const flexible_grid_cells: FlexibleGridCell[] = [];
    for (const [y, column] of spreadsheet.columns) {
        for (const [x, value] of column.rows) {
            const valueStr = Buffer.from(value).toString();
            const valueDecrp = await aesDecrypt(valueStr, fnKD);
            const key: FlexGridDataKey = { col: y, row: x };
            flexible_grid_cells.push({ key, value: valueDecrp });
        }
    }
    return flexible_grid_cells;
}

export async function decrypt_and_adapt_columns(columns: ICGridColumns, fnKD: Uint8Array<ArrayBufferLike>): Promise<FlexibleGridColumn[]> {
    const flexible_grid_columns: FlexibleGridColumn[] = [];
    for (const [index, [name, hidden]] of columns) {
        const nameStr = Buffer.from(name).toString();
        const descrpName = await aesDecrypt(nameStr, fnKD);
        flexible_grid_columns.push({ name: descrpName, meta: { index, hidden } });
    }
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
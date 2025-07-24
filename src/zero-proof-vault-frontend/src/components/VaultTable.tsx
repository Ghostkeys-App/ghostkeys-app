import React, { useEffect, useState } from "react";
import setSecretIcon from "../../public/setSecret.svg";
import unsetSecretIcon from "../../public/unSetSecret.svg";
import minusIcon from "../../public/minus.svg";
import { Column, TableVaultData, VaultColumns } from "../utility/vault-provider";
import VaultRow from "./VaultRow";


interface VaultTableProps {
    tableVaultData: TableVaultData;
    setTableVaultData: (newData: TableVaultData) => void;
    columnsVaultData: VaultColumns;
    setColumnsVaultData: (newColumns: VaultColumns) => void;
}


let nextColumnIndex = 1;

export default function VaultTable({ tableVaultData, setTableVaultData, columnsVaultData, setColumnsVaultData }: VaultTableProps) {
    const [editingColIndex, setEditingColIndex] = useState<number | null>(null);
    const [{ colIndex, colNewName }, setColName] = useState<{ colIndex: number, colNewName: string }>({ colIndex: -1, colNewName: "" });
    const [innerTableVaultData, setInnerTableVaultData] = useState(tableVaultData);

    const rows = buildRows(innerTableVaultData, columnsVaultData);

    const handleUpdate = (rowId: number, columnId: string, newValue: string) => {
        let colEntry = Array.from(columnsVaultData.values()).find(c => c.id === columnId);
        if (!colEntry) return;
        const updatedMap = new Map(tableVaultData);
        let matchingKey = [...updatedMap.keys()].find(
            (k) => k.rowId === rowId && k.columnId === columnId
        );
        if (matchingKey) {
            updatedMap.set(matchingKey, newValue);
        } else {
            updatedMap.set({ rowId, columnId }, newValue);
        }
        // Debug logs
        // console.log("Update map");
        // console.log(updatedMap);
        setInnerTableVaultData(updatedMap);
        setTableVaultData(updatedMap);
    };


    const handleDeleteRow = (rowIdToDelete: number) => {
        const updatedMap = new Map(tableVaultData);
        tableVaultData.forEach((value, key) => {
            if (key.rowId === rowIdToDelete) {
                updatedMap.delete(key);
                return;
            };
            const newRowId = key.rowId > rowIdToDelete ? key.rowId - 1 : key.rowId;
            updatedMap.delete(key);
            updatedMap.set({ rowId: newRowId, columnId: key.columnId }, value);
        });
        // Debug logs
        // console.log("Delete map");
        // console.log(updatedMap);
        setInnerTableVaultData(updatedMap);
        setTableVaultData(updatedMap);
        // This is bad... however for now is fine. Persistence is taken care with context and indexedDB - solid result for now
        setTimeout(() => window.location.reload(), 100);
    };

    const handleAddColumn = () => {
        const newColumn: Column = { id: (columnsVaultData.size + 1).toString(), name: `New Column ${nextColumnIndex++}`, hidden: false };
        const updated = new Map(columnsVaultData)
        updated.set(newColumn.name, newColumn);
        setColumnsVaultData(updated);
        setEditingColIndex(columnsVaultData.size); // auto start editing
    };

    const editColumnName = (index: number, newName: string) => {
        setColName({ colIndex: index, colNewName: newName });
    };

    const handleUpdateColumnName = () => {
        const { index, newName } = { index: colIndex, newName: colNewName.trim() };

        if (columnsVaultData.has(newName)) {
            window.alert("Column name is the same, no changes made.");
            setEditingColIndex(null);
            return;
        }
        const updated = new Map(columnsVaultData);
        const oldName = [...updated.keys()][index];
        updated.delete(oldName);
        updated.set(newName, { id: (updated.size + 1).toString(), name: newName, hidden: false });
        setColumnsVaultData(updated);
    }



    const toggleColumnSecret = (index: number, hiddenVal: boolean) => {
        const updated = columnsVaultData.get(index.toString());
        updated!.hidden = hiddenVal;
        columnsVaultData.set(index.toString(), updated!);
        setColumnsVaultData(new Map(columnsVaultData)); // trigger re-render
    };

    const handleDeleteColumn = (index: number) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete column "${columnsVaultData.get(index.toString())?.name}"?`);
        if (!confirmDelete) return;

        columnsVaultData.delete(index.toString());

        const cellsToDelete = Array.from(tableVaultData.keys()).filter(key => key.columnId === index.toString());
        cellsToDelete.forEach(key => tableVaultData.delete(key));

        setColumnsVaultData(new Map(columnsVaultData));
        setTableVaultData(new Map(tableVaultData)); // trigger re-render
        setEditingColIndex(null);
    };

    // Highly inneficient
    function buildRows(
        data: TableVaultData,
        columns: VaultColumns
    ): Record<number, Record<string, string>> {
        const rows: Record<number, Record<string, string>> = {};
        let maxRowId = 0;

        data.forEach((value, { rowId, columnId }) => {
            const col = columns.get(columnId);
            if (!col) return;
            if (!rows[rowId]) rows[rowId] = {};
            rows[rowId][col.name] = value;
            if (rowId > maxRowId) maxRowId = rowId;
        });

        // Append 2 empty rows
        for (let i = 1; i <= 2; i++) {
            const rowId = maxRowId + i;
            rows[rowId] = {};
            for (const col of columns.values()) {
                rows[rowId][col.name] = "";
            }
        }

        return rows;
    }

    return (
        <div className="editor">
            <table className="vault-table">
                <thead>
                    <tr>
                        <th style={{ width: "30px" }}></th>
                        {Array.from(columnsVaultData.entries()).map(([key, col], idx) => (
                            <th key={col.id} className="vault-column-header">
                                <div className="column-header">
                                    {editingColIndex === idx ? (
                                        <input
                                            autoFocus
                                            value={col.name}
                                            onChange={(e) => editColumnName(idx, e.target.value)}
                                            onBlur={() => setEditingColIndex(null)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleUpdateColumnName();
                                                    setEditingColIndex(null);
                                                }
                                            }}
                                        />
                                    ) : (
                                        <span onDoubleClick={() => setEditingColIndex(idx)}>{col.name}</span>
                                    )}

                                    <div className="column-icons">
                                        <img
                                            src={col.hidden ? setSecretIcon : unsetSecretIcon}
                                            alt={col.hidden ? "Secret" : "Plain"}
                                            className="secret-toggle-icon"
                                            onClick={() => toggleColumnSecret(idx, col.hidden)}
                                        />
                                        <img
                                            src={minusIcon}
                                            alt="Remove column"
                                            className="remove-column-icon"
                                            onClick={() => handleDeleteColumn(idx)}
                                        />
                                    </div>
                                </div>
                            </th>
                        ))}
                        <th className="add-column-btn">
                            <span className="add-column-btn-span" onClick={handleAddColumn}>+</span>
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {Object.entries(rows)
                        .filter(([_, row], idx, arr) => {
                            const isEmpty = Object.values(row).every((v) => v.trim() === "");
                            const isOneOfLastTwo = idx >= arr.length - 2;
                            return !isEmpty || isOneOfLastTwo;
                        })
                        .map(([rowIdStr, row]) => (
                            <VaultRow
                                key={rowIdStr}
                                rowId={parseInt(rowIdStr)}
                                row={row}
                                columnsVaultData={columnsVaultData}
                                handleUpdate={handleUpdate}
                                handleDeleteRow={handleDeleteRow}
                            />
                        ))}
                </tbody>

            </table>
        </div>
    );

}
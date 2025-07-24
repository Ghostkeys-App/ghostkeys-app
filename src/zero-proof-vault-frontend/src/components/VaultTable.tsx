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

    const handleUpdate = (rowId: number, columnId: string, value: string) => {
        const updated = new Map(tableVaultData);
        updated.set({ columnId, rowId }, value);
        setTableVaultData(updated);
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

    const handleDeleteRow = (rowIdToDelete: number) => {
        const updatedMap: TableVaultData = new Map();
        tableVaultData.forEach((value, key) => {
            const { columnId, rowId } = key;
            if (rowId === rowIdToDelete) {
                return;
            }
            if (rowId > rowIdToDelete) {
                updatedMap.set({ columnId, rowId: rowId - 1 }, value);
            } else {
                updatedMap.set(key, value);
            }
        });
        setTableVaultData(updatedMap);
    };


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
    const getRowsGrouped = () => {
        const rowsGrouped: Record<number, Record<string, string>> = {};

        let maxRowId = 0;

        // Group real rows
        tableVaultData.forEach((value, { columnId, rowId }) => {
            if (!rowsGrouped[rowId]) rowsGrouped[rowId] = {};
            rowsGrouped[rowId][columnId] = value;
            if (rowId > maxRowId) maxRowId = rowId;
        });

        // Remove truly empty rows (if any were left by mistake)
        Object.entries(rowsGrouped).forEach(([rowIdStr, row]) => {
            const hasData = Object.values(row).some((val) => val.trim() !== "");
            if (!hasData) delete rowsGrouped[parseInt(rowIdStr)];
        });

        // Add 2 empty rows at the end
        let newId = maxRowId + 1;
        for (let i = 0; i < 2; i++, newId++) {
            rowsGrouped[newId] = {};
            for (const col of columnsVaultData.values()) {
                rowsGrouped[newId][col.id] = "";
            }
        }

        return { rowsGrouped };
    };


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
                    {(() => {
                        const { rowsGrouped } = getRowsGrouped();
                        return Object.entries(rowsGrouped).map(([rowIdStr, row]) => {
                            const rowId = parseInt(rowIdStr);
                            return (
                                <VaultRow
                                    rowId={rowId}
                                    row={row}
                                    columnsVaultData={columnsVaultData}
                                    handleDeleteRow={handleDeleteRow}
                                    handleUpdate={handleUpdate}
                                />
                            );
                        })
                    })()
                    }
                </tbody>

            </table>
        </div>
    );

}
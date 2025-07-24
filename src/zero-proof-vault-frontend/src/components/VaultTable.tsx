import React, { useState } from "react";
import VaultCell from "./VaultCell";
import setSecretIcon from "../../public/setSecret.svg";
import unsetSecretIcon from "../../public/unSetSecret.svg";
import minusIcon from "../../public/minus.svg";
import { Column, TableVaultData, VaultColumns } from "../utility/vault-provider";


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

    // const handleUpdate = (index: number, key: string, value: string) => {
    //     setTableVaultData((prev) => {
    //         const updated = new Map(prev);
    //         updated.set({ columnId: key, rowId: index }, value);
    //         return updated;
    //     });
    // };

    const handleUpdate = (rowId: number, columnId: string, value: string) => {
        const updated = new Map(tableVaultData);
        updated.set({ columnId, rowId }, value);
        setTableVaultData(updated)
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

    const handleDeleteRow = (rowId: number) => {
        const coordinatesToDelete = Array.from(tableVaultData.keys()).filter(key => key.rowId === rowId);
        coordinatesToDelete.forEach(key => tableVaultData.delete(key));
        setTableVaultData(new Map(tableVaultData)); // trigger re-render
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
        let lastRowNumber = 1;
        tableVaultData.forEach((value, { columnId, rowId }) => {
            if (!rowsGrouped[rowId]) rowsGrouped[rowId] = {};
            rowsGrouped[rowId][columnId] = value;
            lastRowNumber = rowId;
        });
        for (let _ = 0; _ < 2; _++) {
            lastRowNumber++;
            for (let i = 1; i <= columnsVaultData.size; i++) {
                if (!rowsGrouped[lastRowNumber]) rowsGrouped[lastRowNumber] = {};
                rowsGrouped[lastRowNumber][i] = '';
            }
        }
        return { rowsGrouped, lastRowNumber };
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
                    {(() => {
                        const { rowsGrouped, lastRowNumber } = getRowsGrouped();
                        return Object.entries(rowsGrouped).map(([rowIdStr, row]) => {
                            const rowId = parseInt(rowIdStr);
                            const isExtra = rowId >= lastRowNumber;

                            return (
                                <tr key={rowId} className={isExtra ? "extra-row" : ""}>
                                    <td className="row-control" onClick={() => !isExtra ? handleDeleteRow(rowId) : null}>
                                        {!isExtra && (
                                            <span className="remove-row">─</span>
                                        )}
                                    </td>
                                    {Array.from(columnsVaultData.values()).map((col) => (
                                        <td key={col.id} className="vault-cell">
                                            <VaultCell
                                                type={col.hidden ? "password" : "text"}
                                                value={row[col.name] || ""}
                                                onChange={(val) => handleUpdate(rowId, col.name, val)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            );
                        })
                    })()
                    }
                </tbody>

            </table>
        </div>
    );

}
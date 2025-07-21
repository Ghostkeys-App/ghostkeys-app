import React, { useState } from "react";
import VaultCell from "./VaultCell";
import setSecretIcon from "../../public/setSecret.svg";
import unsetSecretIcon from "../../public/unSetSecret.svg";
import minusIcon from "../../public/minus.svg";


type VaultBlob = Record<string, string>;

interface VaultTableProps {
    blobs: VaultBlob[];
    passwords: Record<string, string>;
    signedKey: Uint8Array | null;
    setPasswords: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setBlobs: React.Dispatch<React.SetStateAction<VaultBlob[]>>;
}

let nextColumnIndex = 1;

export default function VaultTable({ blobs, setBlobs }: VaultTableProps) {
    const [columns, setColumns] = useState<Array<{ name: string; secret: boolean }>>([
        { name: "Name", secret: false },
        { name: "Secret", secret: true }
    ]);
    const [editingColIndex, setEditingColIndex] = useState<number | null>(null);


    const handleUpdate = (index: number, key: string, value: string) => {
        setBlobs((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [key]: value };
            return updated;
        });
    };

    const getDisplayRows = () => {
        const filled = blobs;
        const empty = Array.from({ length: 2 }, () => Object.fromEntries(columns.map(c => [c, ""])));
        return [...filled, ...empty];
    };

    const handleAddColumn = () => {
        setColumns([...columns, { name: `New Column ${nextColumnIndex++}`, secret: false }]);
        setEditingColIndex(columns.length); // auto start editing
    };

    const handleUpdateColumnName = (index: number, newName: string) => {
        if (columns.find(c => c.name === newName)) {
            window.alert("Column name is the same, no changes made.");
            setEditingColIndex(null);
            return;
        }
        const updated = [...columns];
        updated[index].name = newName;
        setColumns(updated);
    }

    const handleDeleteRow = (rowIndex: number) => {
        const updated = [...blobs];
        updated.splice(rowIndex, 1);
        setBlobs(updated);
    };

    const toggleColumnSecret = (index: number) => {
        const updated = [...columns];
        updated[index].secret = !updated[index].secret;
        setColumns(updated);
    };

    const handleDeleteColumn = (index: number) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete column "${columns[index].name}"?`);
        if (!confirmDelete) return;

        const updatedCols = columns.filter((_, i) => i !== index);
        const updatedRows = blobs.map((row) => {
            const newRow = { ...row };
            delete newRow[columns[index].name];
            return newRow;
        });

        setColumns(updatedCols);
        setBlobs(updatedRows);
    };


    return (
        <div className="editor">
            <table className="vault-table">
                <thead>
                    <tr>
                        <th style={{ width: "30px" }}></th>
                        {columns.map((col, idx) => (
                            <th key={idx} className="vault-column-header">
                                <div className="column-header">
                                    {editingColIndex === idx ? (
                                        <input
                                            autoFocus
                                            value={col.name}
                                            onChange={(e) => handleUpdateColumnName(idx, e.target.value)}
                                            onBlur={() => setEditingColIndex(null)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") setEditingColIndex(null);
                                            }}
                                        />
                                    ) : (
                                        <span onDoubleClick={() => setEditingColIndex(idx)}>{col.name}</span>
                                    )}

                                    <div className="column-icons">
                                        <img
                                            src={col.secret ? setSecretIcon : unsetSecretIcon}
                                            alt={col.secret ? "Secret" : "Plain"}
                                            className="secret-toggle-icon"
                                            onClick={() => toggleColumnSecret(idx)}
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
                    {getDisplayRows().map((row, rowIndex) => {
                        const isExtra = rowIndex >= blobs.length;

                        return (
                            <tr key={rowIndex} className={isExtra ? "extra-row" : ""}>
                                <td className="row-control" onClick={() => !isExtra ? handleDeleteRow(rowIndex) : null}>
                                    {!isExtra && (
                                        <span
                                            className="remove-row"
                                        >─</span>
                                    )}
                                </td>
                                {columns.map((col, colIndex) => (
                                    <td key={colIndex} className="vault-cell">
                                        <VaultCell
                                            type={col.secret ? "password" : "text"}
                                            value={row[col.name] || ""}
                                            onChange={(val) => handleUpdate(rowIndex, col.name, val)}
                                        />
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
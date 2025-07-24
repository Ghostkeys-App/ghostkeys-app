import { useState } from "react";
import { VaultColumns } from "../utility/vault-provider";
import VaultCell from "./VaultCell";

interface VaultRowProp {
    rowId: number;
    row: Record<string, string>;
    columnsVaultData: VaultColumns;
    handleDeleteRow: (value: number) => void;
    handleUpdate: (rowId: number, columnId: string, value: string) => void;
}

export default function VaultRow({ rowId, row, columnsVaultData, handleDeleteRow, handleUpdate }: VaultRowProp) {
    const [isExtra, setIsExtra] = useState(true);
    const handleOnChange = (value: string) => {
        setIsExtra(value.length == 0);
    };

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
                        onChange={(val) => handleUpdate(rowId, col.id, val)}
                        handleOnChange={handleOnChange}
                    />
                </td>
            ))}
        </tr>
    );
}


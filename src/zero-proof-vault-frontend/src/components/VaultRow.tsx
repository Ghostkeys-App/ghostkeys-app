import { useState } from "react";
import { VaultColumns } from "../utility/vault-provider";
import VaultCell from "./VaultCell";

interface VaultRowProp {
    rowId: number;
    row: Record<string, string>;
    columnsVaultData: VaultColumns;
    handleDeleteRow: (rowId: number) => void;
    handleUpdate: (rowId: number, columnName: string, value: string) => void;
}

export default function VaultRow({
    rowId,
    row,
    columnsVaultData,
    handleDeleteRow,
    handleUpdate,
}: VaultRowProp) {
    // Debug logs
    // console.log("row", row);
    // console.log("rowId", rowId); 
    // console.log("columnsVaultData", columnsVaultData);
    const [isEmpty, setIsEmpty] = useState(Object.values(row).every((v) => v === ""));
    const handleOnChange = (value: string) => {
        setIsEmpty(value.length == 0);
    };

    return (
        <tr className={isEmpty ? "extra-row" : ""}>
            <td className="row-control" onClick={() => !isEmpty && handleDeleteRow(rowId)}>
                {!isEmpty && <span className="remove-row">─</span>}
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


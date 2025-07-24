// ManageVault.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIdentitySystem } from "../utility/identity";
import Sidebar from "../components/Sidebar";
import VaultTable from "../components/VaultTable";
import TopBar from "../components/TopBar";
import { TableVaultData, useVaultProvider, VaultColumns } from "../utility/vault-provider";
import "../styles/theme.scss";

export default function ManageVault() {
  const navigate = useNavigate();
  const { currentProfile, currentVault } = useIdentitySystem();
  const { vaultsData, vaultsColumns, setAllVaultsData } = useVaultProvider();
  const [vaultData, setVaultData] = useState<TableVaultData>(new Map());
  const [columnData, setColumnData] = useState<VaultColumns>(new Map());
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVaultData = async () => {
      if (!currentProfile || !currentProfile.icpAccount || !currentVault) {
        navigate("/");
        return;
      }
      if (dataLoaded) return;
      let tempVaultData = vaultsData.get(currentVault.icpPublicAddress);
      let tempColumns = vaultsColumns.get(currentVault.icpPublicAddress);

      // If no data exists, initialize with default columns
      if (!tempColumns) {
        tempColumns = new Map();
        tempColumns.set("1", { id: "1", name: "Name", hidden: false });
        tempColumns.set("2", { id: "2", name: "Secret", hidden: true })
        const temp = new Map(vaultsColumns);
        temp.set(currentVault.icpPublicAddress, tempColumns);
        setAllVaultsData(vaultsData, temp);
      }

      setVaultData(tempVaultData || new Map());
      setColumnData(tempColumns);
      setDataLoaded(true);
    };

    loadVaultData();
    setLoading(false);
  }, [currentVault, navigate, vaultsData, vaultsColumns]);

  const setVaultDataHandler = (newData: TableVaultData) => {
    setVaultData(newData);
    if (currentVault) {
      const updatedVaultsData = new Map(vaultsData);
      updatedVaultsData.set(currentVault.icpPublicAddress, newData);
      setAllVaultsData(updatedVaultsData, vaultsColumns);
    }
  };

  const setColumnDataHandler = (newColumns: VaultColumns) => {
    setColumnData(newColumns);
    if (currentVault) {
      const updatedVaultsColumns = new Map(vaultsColumns);
      updatedVaultsColumns.set(currentVault.icpPublicAddress, newColumns);
      setAllVaultsData(vaultsData, updatedVaultsColumns);
    }
  };

  if (loading) {
    return (
      <div className="flex-center flex-column">
        <div className="card text-center">
          <div className="loading" style={{ width: '40px', height: '40px', margin: '20px auto' }}></div>
          <h3>Loading Your Vault...</h3>
          <p>Please wait while we securely load your password entries.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-app">
      <TopBar profile={currentProfile} />
      <div className="vault-layout">
        <Sidebar />
        <VaultTable
          tableVaultData={vaultData}
          setTableVaultData={setVaultDataHandler}
          columnsVaultData={columnData}
          setColumnsVaultData={setColumnDataHandler}
        />
      </div>
    </div>
  );
}

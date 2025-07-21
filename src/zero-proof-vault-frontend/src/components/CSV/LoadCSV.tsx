// components/LoadCSV.jsx
import React, { useState } from "react";

export default function LoadCSV({ onImportEntries, _onImportEntry }:
   { onImportEntries: (entries: Array<{ url: string; username: string; password: string }>) => Promise<boolean>; // Leave type declaration for later
   _onImportEntry: (entry: { url: string; username: string; password: string }) => Promise<void>; }) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
    } else {
      alert("Please select a valid CSV file");
    }
  };

  const parseCSV = (csvText: string): Array<{ url: string; username: string; password: string }> => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Find column indices
    const urlIndex = headers.findIndex(h => h.includes('url') || h.includes('website') || h.includes('site'));
    const usernameIndex = headers.findIndex(h => h.includes('username') || h.includes('user') || h.includes('email'));
    const passwordIndex = headers.findIndex(h => h.includes('password') || h.includes('pass'));
    
    if (urlIndex === -1 || usernameIndex === -1 || passwordIndex === -1) {
      throw new Error("CSV must contain columns for URL, username, and password");
    }
    
    const entries = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length >= Math.max(urlIndex, usernameIndex, passwordIndex) + 1) {
          entries.push({
            url: values[urlIndex],
            username: values[usernameIndex],
            password: values[passwordIndex]
          });
        }
      }
    }
    
    return entries;
  };

  const handleImport = async () => {
    if (!file) {
      alert("Please select a CSV file first");
      return;
    }

    setIsProcessing(true);
    
    try {
      const csvText = await file.text();
      const entries = parseCSV(csvText);
      
      // setProgress({ current: 0, total: entries.length });
      const resultImport = await onImportEntries(entries);

      // For future one off import
      // for (let i = 0; i < entries.length; i++) {
      //   const entry = entries[i];
      //   setProgress({ current: i + 1, total: entries.length });
        
      //   // Call the handleAdd function from ManageVault for each entry
      //   await onImportEntry(entry);
        
      //   // Small delay to show progress
      //   await new Promise(resolve => setTimeout(resolve, 100));
      // }
      
      alert(`Successfully imported ${entries.length} entries!`);
      setFile(null);
      
    } catch (error: any) {
      console.error("Import error:", error);
      alert("Error importing CSV: " + error.message);
    } finally {
      setIsProcessing(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  // Progress popup overlay
  if (isProcessing) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(10px)'
      }}>
        <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <h3>📁 Importing CSV Entries...</h3>
          <div className="mb-20">
            <div className="loading" style={{ width: '40px', height: '40px', margin: '20px auto' }}></div>
          </div>
          <p style={{ fontSize: '24px', margin: '16px 0', color: 'var(--text-primary)' }}>
            {progress.current}/{progress.total}
          </p>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '10px'
          }}>
            <div style={{
              height: '100%',
              background: 'var(--cyber-gradient)',
              width: `${(progress.current / progress.total) * 100}%`,
              transition: 'width 0.3s ease',
              borderRadius: '4px'
            }}></div>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>
            Processing entry {progress.current} of {progress.total}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label className="form-label">📁 Select CSV File</label>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        CSV should contain columns for URL/Website, Username, and Password
      </p>
      
      <div className="flex gap-10" style={{ alignItems: 'center' }}>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="form-input"
          style={{ flex: 1, padding: '8px 12px' }}
        />
        <button 
          className="btn"
          onClick={handleImport}
          disabled={!file}
          style={{ 
            padding: '12px 16px', 
            minWidth: 'auto',
            opacity: file ? 1 : 0.5,
            cursor: file ? 'pointer' : 'not-allowed',
            background: file ? 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' : 'rgba(0, 242, 254, 0.1)',
            color: file ? 'var(--darker-bg)' : 'var(--text-secondary)',
            border: file ? 'none' : '1px solid rgba(0, 242, 254, 0.3)',
            boxShadow: file ? '0 4px 15px rgba(0, 242, 254, 0.3)' : 'none'
          }}
        >
          📥 Import CSV
        </button>
      </div>
      
      {file && (
        <div className="status-message success" style={{ marginTop: '10px' }}>
          <strong>Selected file:</strong> {file.name}
        </div>
      )}
    </div>
  );
}

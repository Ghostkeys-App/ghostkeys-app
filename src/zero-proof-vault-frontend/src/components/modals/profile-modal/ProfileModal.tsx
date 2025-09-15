import GKFormModal from "../gk-form-modal/GKFormModal.tsx";
import GKModal from "../gk-modal/GKModal.tsx";
import { useIdentitySystem } from "../../../utility/identity";
import { useCallback, useMemo, useState } from "react";
import { toast } from "../../../utility/toast";

type Props = {
    open: boolean;
    onClose: () => void;
    onImport: (seedPhrase: string) => Promise<void>;
};

export default function ProfileModal({ open, onClose, onImport }: Props) {
    const { currentProfile, profiles } = useIdentitySystem();
    const [showReveal, setShowReveal] = useState(false);
    const [showAdd, setShowAdd] = useState(false);

    const copy = useCallback(async () => {
        if (!currentProfile.seedPhrase) return;
        try {
            await navigator.clipboard.writeText(currentProfile.seedPhrase);
            toast.success("Successfully coppied seed phrase!", { idiotProof: true })
        } catch {
            toast.error("Couldn't copy seed phrase. Try again!", { idiotProof: true })

        }
    }, [currentProfile]);

    const items = useMemo(() => profiles || [], [profiles]);

    return (
        <>
            <GKModal
                open={open}
                onClose={onClose}
                title="Profiles"
                description="Choose an identity or add a new profile."
                width="md"
                actions={
                    <>
                        <button
                            type="button"
                            className="gk-btn ghost"
                            onClick={() => setShowReveal(true)}
                            disabled={!currentProfile.seedPhrase}
                            title={"Reveal current seed phrase"}
                        >
                            Reveal current seed
                        </button>
                        <button
                            type="button"
                            className="gk-btn primary"
                            onClick={() => setShowAdd(true)}
                            title={"Add a profile from seed"}
                        >
                            Add Profile
                        </button>
                        <button className="gk-btn ghost" onClick={onClose}>Close</button>
                    </>
                }
            >
                <div className="gk-form">
                    {items.length === 0 ? (
                        <div>No profiles found.</div>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {items.map((p) => {
                                const isActive = p.active;
                                const principalSlug = shortenIdFromUserId(p.userID);
                                return (
                                    <li key={p.userID} className="flex items-center justify-between gap-3 bg-[rgba(255,255,255,0.06)] rounded-md px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <img src={'/ghost-white.png'} alt="id" style={{ width: 20, height: 20, opacity: 0.9 }} />
                                            <div className="flex flex-col">
                                                <span className="text-sm">{principalSlug}</span>
                                                <span className="text-xs opacity-70">{isActive ? 'Active' : 'Stored'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                className={`gk-btn ${isActive ? 'ghost' : 'primary'}`}
                                                disabled={isActive}
                                                onClick={async () => {
                                                    try {
                                                        // Use existing import flow to also reload vaults and switch identity
                                                        await onImport(p.seedPhrase);
                                                        onClose();
                                                    } catch (e) {
                                                        console.warn('Switch profile failed', e);
                                                    }
                                                }}
                                            >
                                                {isActive ? 'Active' : 'Switch'}
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </GKModal>

            {/* Add Profile (seed input) */}
            <GKFormModal
                open={showAdd}
                title="Add Profile"
                description="Enter a 12-word seed phrase to add a profile."
                fields={[
                    {
                        name: "seed",
                        label: "Seed phrase",
                        placeholder: "Enter your 12 word phrase",
                        type: "textarea",
                        required: true,
                    },
                ]}
                okLabel="Add"
                cancelLabel="Cancel"
                onClose={() => setShowAdd(false)}
                onSubmit={async (values) => {
                    if (values.seed && values.seed.trim()) {
                        await onImport(values.seed.trim());
                        setShowAdd(false);
                        onClose();
                    }
                }}
            />

            <GKModal
                open={showReveal}
                onClose={() => setShowReveal(false)}
                title="Your Seed Phrase"
                description="Keep this safe. Anyone with this phrase can control your vault."
                width="md"
                actions={
                    <>
                        <button className="gk-btn ghost" onClick={copy} disabled={!currentProfile.seedPhrase}>
                            Copy
                        </button>
                        <button className="gk-btn primary" onClick={() => setShowReveal(false)}>
                            Close
                        </button>
                    </>
                }
            >
                <p className="break-words whitespace-pre-wrap">
                    {currentProfile.seedPhrase}
                </p>
            </GKModal>
        </>
    );
}

function shortenIdFromUserId(userID: string): string {
    try {
        const id = userID?.startsWith('UserID_') ? userID.slice('UserID_'.length) : userID;
        if (!id || id.length <= 16) return id;
        return `${id.slice(0, 8)}..${id.slice(-6)}`;
    } catch {
        return userID;
    }
}

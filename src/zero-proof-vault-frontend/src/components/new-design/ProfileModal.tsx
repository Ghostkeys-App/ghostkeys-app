import GKFormModal from "./GKFormModal";
import GKModal from "./GKModal";
import { useIdentitySystem } from "../../utility/identity";
import { useCallback, useState } from "react";
import { toast } from "../../utility/toast";

type Props = {
    open: boolean;
    onClose: () => void;
    onImport: (seedPhrase: string) => Promise<void>;
};

export default function ProfileModal({ open, onClose, onImport }: Props) {
    const { currentProfile } = useIdentitySystem();
    const [showReveal, setShowReveal] = useState(false);

    const copy = useCallback(async () => {
        if (!currentProfile.seedPhrase) return;
        try {
            await navigator.clipboard.writeText(currentProfile.seedPhrase);
            toast.success("Successfully coppied seed phrase!")
        } catch {
            toast.error("Couldn't copy seed phrase. Try again!")

        }
    }, [currentProfile]);

    return (
        <>
            <GKFormModal
                open={open}
                title="Profile"
                description="Import or view your seed phrase."
                fields={[
                    {
                        name: "seed",
                        label: "Seed phrase",
                        placeholder: "Enter your 12 word phrase",
                        type: "textarea",
                        required: true,
                    },
                ]}
                okLabel="Import"
                cancelLabel="Close"
                onClose={onClose}
                onSubmit={async (values) => {
                    if (values.seed && values.seed.trim()) {
                        await onImport(values.seed.trim());
                    }
                    onClose();
                }}
                extraActions={
                    <button
                        type="button"
                        className="gk-btn ghost"
                        onClick={() => setShowReveal(true)}
                        disabled={!currentProfile.seedPhrase}
                        title={"Reveal current seed phrase"}
                    >
                        Reveal current seed
                    </button>
                }
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

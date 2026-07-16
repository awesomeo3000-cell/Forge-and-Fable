"use client";

import { memo, useState, useCallback } from "react";
import CharacterPortrait from "@/components/portraits/CharacterPortrait";
import PortraitSelectorModal from "@/components/portraits/PortraitSelectorModal";

type Props = {
  /** Current portrait ID (opaque catalog ID or external URL). */
  value?: string;
  /** Character name for initials fallback. */
  characterName: string;
  /** Ancestry key used to pre-filter the Suggested tab. */
  suggestedAncestry?: string;
  /** Called with the selected catalog portrait ID. */
  onChange: (portraitId: string) => void;
  /** Optional CSS class for the field container. */
  className?: string;
};

/**
 * Compact portrait field: preview + button that opens the portrait selector
 * modal. For use in character creation, the appearance panel, and any future
 * portrait picker surface.
 */
export default memo(function PortraitField({
  value,
  characterName,
  suggestedAncestry,
  onChange,
  className = "",
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const hasPortrait = !!value;

  const handleSave = useCallback(
    (portraitId: string) => {
      onChange(portraitId);
      setModalOpen(false);
    },
    [onChange],
  );

  const handleClose = useCallback(() => setModalOpen(false), []);

  return (
    <>
      <div className={`portrait-field ${className}`}>
        <CharacterPortrait
          portraitId={value || null}
          characterName={characterName}
          size={96}
          shape="rounded"
          decorative
          className="portrait-field-preview"
        />
        <div className="portrait-field-info">
          <span className="portrait-field-label">Character Portrait</span>
          <button
            type="button"
            className="portrait-field-btn"
            onClick={() => setModalOpen(true)}
          >
            {hasPortrait ? "Change Portrait" : "Choose Portrait"}
          </button>
        </div>
      </div>
      <PortraitSelectorModal
        open={modalOpen}
        value={value || null}
        suggestedAncestry={suggestedAncestry}
        characterName={characterName}
        onSave={handleSave}
        onClose={handleClose}
      />
    </>
  );
});

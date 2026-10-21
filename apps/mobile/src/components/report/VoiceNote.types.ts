/** Where the voice note is in its upload/transcription journey (owned by the report screen). */
export type VoiceStatus = 'none' | 'transcribing' | 'done' | 'failed';

export type VoiceNoteProps = {
  /** Open with the "record or type" hint showing (arrived from the home screen's mic shortcut). */
  highlight?: boolean;
  status: VoiceStatus;
  /** A clip was recorded and is attached to the report. */
  onRecorded: (localUri: string) => void;
  /** The citizen deleted the clip (or started re-recording): the attachment and its status go away. */
  onRemoved: () => void;
};

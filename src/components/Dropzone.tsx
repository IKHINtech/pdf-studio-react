import { UploadCloud } from 'lucide-react';

type DropzoneProps = {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
};

export function Dropzone({ onFilesSelected, disabled = false }: DropzoneProps) {
  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    onFilesSelected(files);
  }

  return (
    <label
      className={`dropzone ${disabled ? 'is-disabled' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!disabled) handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        type="file"
        accept="application/pdf,.pdf"
        multiple
        disabled={disabled}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <span className="dropzone-icon"><UploadCloud size={28} /></span>
      <strong>Upload PDF</strong>
      <small>Pilih beberapa PDF atau drag ke sini</small>
    </label>
  );
}

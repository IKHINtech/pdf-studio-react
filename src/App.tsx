import { useEffect, useMemo, useState } from 'react';
import { Files, FolderOpen, PanelLeftClose, PanelLeftOpen, RotateCw, Save, Settings2, Trash2 } from 'lucide-react';
import { Dropzone } from './components/Dropzone';
import { PageWorkspace } from './components/PageWorkspace';
import { downloadBlob } from './lib/download';
import { buildPdfFromPages, loadPdfSource, sourceToPages } from './lib/pdf';
import type { PdfAnnotation, PdfPageItem, SourcePdf } from './types/pdf';
import './styles.css';

export default function App() {
  const [sources, setSources] = useState<SourcePdf[]>([]);
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'file' | 'tools'>('file');
  const [status, setStatus] = useState('Upload PDF untuk mulai merge dan susun halaman.');

  const outputName = useMemo(() => {
    if (sources.length === 0) return 'merged.pdf';
    const firstName = sources[0]?.name.replace(/\.pdf$/i, '') || 'merged';
    return `${firstName}-edited.pdf`;
  }, [sources]);
  const totalPages = pages.length;
  const totalFiles = sources.length;

  useEffect(() => {
    if (pages.length === 0) {
      setSelectedPageId(null);
      return;
    }

    if (!selectedPageId || !pages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages, selectedPageId]);

  async function addFiles(files: File[]) {
    await appendOrInsertFiles(files, pages.length);
  }

  async function insertFilesAfter(index: number, files: File[]) {
    await appendOrInsertFiles(files, index + 1);
  }

  async function appendOrInsertFiles(files: File[], insertAt: number) {
    if (files.length === 0) {
      setStatus('File yang dipilih bukan PDF.');
      return;
    }

    setIsBusy(true);
    setStatus(`Memproses ${files.length} PDF...`);

    try {
      const loadedSources = await Promise.all(files.map(loadPdfSource));
      const loadedPages = loadedSources.flatMap(sourceToPages);
      const safeIndex = Math.max(0, Math.min(insertAt, pages.length));

      setSources((current) => [...current, ...loadedSources]);
      setPages((current) => [...current.slice(0, safeIndex), ...loadedPages, ...current.slice(safeIndex)]);
      if (loadedPages[0]) setSelectedPageId(loadedPages[0].id);

      setStatus(`Berhasil menambahkan ${loadedSources.length} PDF dengan total ${loadedPages.length} halaman.`);
    } catch (error) {
      console.error(error);
      setStatus('Gagal membaca PDF. Pastikan file tidak rusak atau terenkripsi.');
    } finally {
      setIsBusy(false);
    }
  }

  async function exportPdf() {
    setIsBusy(true);
    setStatus('Membuat PDF hasil...');

    try {
      const blob = await buildPdfFromPages(pages, annotations);
      downloadBlob(blob, outputName);
      setStatus('PDF berhasil dibuat dan di-download.');
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Gagal membuat PDF.');
    } finally {
      setIsBusy(false);
    }
  }

  function clearAll() {
    setSources([]);
    setPages([]);
    setSelectedPageId(null);
    setAnnotations([]);
    setStatus('Semua file sudah dibersihkan.');
  }

  function reverseOrder() {
    setPages((current) => [...current].reverse());
    setStatus('Urutan halaman dibalik.');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            <Files size={18} />
          </div>
          <div className="topbar-copy">
            <strong>PDF Studio</strong>
            <span>{sources[0]?.name ?? 'Workspace baru'}</span>
          </div>
        </div>

        <div className="topbar-meta" aria-label="Ringkasan dokumen">
          <div className="topbar-pill">
            <span>File</span>
            <strong>{totalFiles}</strong>
          </div>
          <div className="topbar-pill">
            <span>Halaman</span>
            <strong>{totalPages}</strong>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="button nav-button nav-button-ghost"
            type="button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? 'Tampilkan sidebar' : 'Minimize sidebar'}
            aria-label={isSidebarCollapsed ? 'Tampilkan sidebar' : 'Minimize sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {isSidebarCollapsed ? 'Tampilkan sidebar' : 'Minimize sidebar'}
          </button>
          <button className="button nav-button" disabled={isBusy || pages.length === 0} onClick={reverseOrder}>
            <RotateCw size={16} /> Balik urutan
          </button>
          <button className="button primary nav-button" disabled={isBusy || pages.length === 0} onClick={exportPdf}>
            <Save size={16} /> Export PDF
          </button>
        </div>
      </header>

      <section className="workspace-shell">
        <section className={`workspace editor-layout ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
          <aside className={`sidebar compact-sidebar ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
            <div className="sidebar-tabs">
              <button
                className="sidebar-rail-toggle"
                type="button"
                onClick={() => setIsSidebarCollapsed((current) => !current)}
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <button
                className={`sidebar-tab-button ${activeSidebarTab === 'file' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setActiveSidebarTab('file')}
                title="File"
                aria-label="File"
              >
                <FolderOpen size={18} />
                <span>File</span>
              </button>
              <button
                className={`sidebar-tab-button ${activeSidebarTab === 'tools' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setActiveSidebarTab('tools')}
                title="Tools"
                aria-label="Tools"
              >
                <Settings2 size={18} />
                <span>Tools</span>
              </button>
            </div>

            <div className="sidebar-content">
              {activeSidebarTab === 'file' ? (
                <div className="sidebar-section">
                  <span className="sidebar-label">File</span>
                  <div className="panel sidebar-panel">
                    <h2>Upload PDF</h2>
                    <p className="sidebar-help">Tambahkan file baru ke workspace seperti panel kiri Canva.</p>
                    <Dropzone onFilesSelected={addFiles} disabled={isBusy} />
                  </div>
                </div>
              ) : (
                <div className="sidebar-section">
                  <span className="sidebar-label">Tools</span>
                  <div className="panel sidebar-panel">
                    <h2>Aksi Dokumen</h2>
                    <div className="button-stack">
                      <button className="button primary sidebar-tool-button" disabled={isBusy || pages.length === 0} onClick={exportPdf}>
                        <Save size={18} /> Export PDF
                      </button>
                      <button className="button sidebar-tool-button" disabled={isBusy || pages.length === 0} onClick={reverseOrder}>
                        <RotateCw size={18} /> Balik Urutan
                      </button>
                      <button className="button danger sidebar-tool-button" disabled={isBusy || pages.length === 0} onClick={clearAll}>
                        <Trash2 size={18} /> Bersihkan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="sidebar-footer">
                <span className="sidebar-footer-label">Status</span>
                <div className="status-box sidebar-status">
                  <strong>Aktivitas workspace</strong>
                  <p>{status}</p>
                </div>
              </div>
            </div>
          </aside>

          <section className="content-area editor-area">
            {pages.length === 0 ? (
              <div className="empty-state">
                <Files size={44} />
                <h3>Belum ada PDF</h3>
                <p>Upload satu atau beberapa file PDF. Setelah itu editor akan menampilkan satu halaman besar dan timeline halaman di bawahnya.</p>
              </div>
            ) : (
              <PageWorkspace
                pages={pages}
                selectedPageId={selectedPageId}
                onSelectPage={setSelectedPageId}
                onChange={setPages}
                onInsertAfter={insertFilesAfter}
                annotations={annotations}
                onAnnotationsChange={setAnnotations}
                disabled={isBusy}
              />
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

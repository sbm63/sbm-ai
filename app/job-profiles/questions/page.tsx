'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type QItem = { question: string; expectedAnswer?: string };
const newRow = (): QItem => ({ question: '', expectedAnswer: '' });

export default function JobQuestionsPage() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const router = useRouter();

  const [jobTitle, setJobTitle] = useState('');
  const [existingCount, setExistingCount] = useState(0);
  const [existing, setExisting] = useState<QItem[]>([]);
  const [rows, setRows] = useState<QItem[]>([newRow()]);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load job meta + existing questions
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/job-profiles/${idParam}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Failed to load job (${res.status})`);
        const data = await res.json();
        if (ignore) return;
        const qs: QItem[] = Array.isArray(data?.questions)
          ? data.questions
          : [];
        setJobTitle(data?.title ?? '');
        setExisting(qs);
        setExistingCount(qs.length);
      } catch (e: any) {
        if (!ignore) setError(e?.message || 'Failed to load job');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [idParam]);

  // Deduplicate + trim before save
  const cleanedRows = useMemo(() => {
    const seen = new Set<string>();
    const out: QItem[] = [];
    for (const r of rows) {
      const q = (r.question ?? '').trim();
      if (!q) continue;
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        question: q,
        expectedAnswer: (r.expectedAnswer ?? '').toString(),
      });
    }
    return out;
  }, [rows]);

  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));
  const updateRow = (idx: number, key: keyof QItem, val: string) =>
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)),
    );

  const onSave = async () => {
    setError('');
    if (!cleanedRows.length) return setError('Add at least one question.');
    try {
      setSaving(true);
      const res = await fetch(`/api/job-profiles/${idParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: cleanedRows, questionMode: mode }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to save');
      }

      // Refresh count if you stay; or navigate away
      setRows([newRow()]);
      try {
        const j = await res.json();
        const qs: QItem[] = Array.isArray(j?.questions) ? j.questions : [];
        setExisting(qs);
        setExistingCount(qs.length);
      } catch {}
      router.push('/job-profiles');
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="custom-screen py-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
          Add Questions for: {loading ? 'Loading…' : jobTitle || 'Untitled Job'}
        </h1>

        {/* Existing Q&A (minimal accordion) */}
        <div className="mt-3">
          <h2 className="text-base font-medium text-gray-900">
            Existing Questions & Answers - {loading ? '—' : existingCount}
          </h2>

          {loading ? (
            <div className="mt-2 text-sm text-gray-500">Loading…</div>
          ) : existing.length === 0 ? (
            <div className="mt-2 text-sm text-gray-500">
              No questions added yet.
            </div>
          ) : (
            <div className="mt-2 rounded-md divide-y divide-gray-400">
              {existing.map((item, idx) => (
                <details key={idx} className="group">
                  <summary className="list-none m-0 py-2.5 px-3 flex items-start justify-between cursor-pointer hover:bg-gray-50">
                    <span className="text-sm text-gray-900 pr-3">
                      {idx + 1} - {item.question}
                    </span>
                    <svg
                      className="ml-3 h-4 w-4 text-gray-400 transition-transform group-open:rotate-180"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </summary>
                  <div className="px-3 pb-3 text-sm">
                    {item.expectedAnswer?.trim() ? (
                      <div className="text-gray-700 whitespace-pre-wrap">
                        <span className="font-medium text-gray-900">
                          Expected Answer:
                        </span>
                        <div className="mt-1">{item.expectedAnswer}</div>
                      </div>
                    ) : (
                      <div className="text-gray-500">
                        No expected answer saved.
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mode (compact segmented switch) */}
      <div className="mb-3">
        <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('append')}
            className={`px-3 py-1.5 text-sm border-r border-gray-200 ${
              mode === 'append'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-50'
            }`}
            aria-pressed={mode === 'append'}
          >
            Append
          </button>
          <button
            type="button"
            onClick={() => setMode('replace')}
            className={`px-3 py-1.5 text-sm ${
              mode === 'replace'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-50'
            }`}
            aria-pressed={mode === 'replace'}
          >
            Replace all
          </button>
        </div>
      </div>

      {/* Add form (compact, no card bg) */}
      <div className="space-y-3">
        {rows.map((r, idx) => (
          <div
            key={idx}
            className="rounded-md border border-gray-200 p-3 md:p-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5">
                <label className="block text-[11px] text-gray-500 mb-1">
                  Question
                </label>
                <input
                  className="w-full border border-gray-300 rounded-md px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Explain debouncing vs throttling"
                  value={r.question}
                  onChange={(e) => updateRow(idx, 'question', e.target.value)}
                />
              </div>

              <div className="md:col-span-6">
                <label className="block text-[11px] text-gray-500 mb-1">
                  Expected Answer (optional)
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 h-20 text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Key points the candidate should cover"
                  value={r.expectedAnswer ?? ''}
                  onChange={(e) =>
                    updateRow(idx, 'expectedAnswer', e.target.value)
                  }
                />
              </div>

              <div className="md:col-span-1 flex md:justify-end md:items-center">
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="inline-flex items-center justify-center h-9 w-9 text-sm border border-red-300 bg-red-100 rounded-md hover:bg-red-100"
                  aria-label="Remove row"
                  title="Remove this question"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          onClick={addRow}
        >
          + Add Row
        </button>
        <button
          type="button"
          disabled={saving}
          className="px-4 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
          onClick={onSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {error ? <span className="text-red-600 text-sm">{error}</span> : null}
      </div>
    </section>
  );
}

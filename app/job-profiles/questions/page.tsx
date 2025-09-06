'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2, HelpCircle, FileText, ChevronDown, Save, ArrowLeft } from 'lucide-react';

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
    <div className="custom-screen py-8">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => router.push('/job-profiles')}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Back to Job Profiles"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="page-title">
              Interview Questions
            </h1>
          </div>
          <p className="page-subtitle">
            Manage interview questions for{' '}
            <span className="font-medium text-indigo-600">
              {loading ? 'Loading…' : jobTitle || 'Untitled Job'}
            </span>
          </p>
        </div>
      </div>

      {/* Existing Questions Card */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Existing Questions
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              {loading ? '—' : existingCount} question{existingCount !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="loading-spinner mr-2"></div>
              <span className="text-gray-600">Loading questions...</span>
            </div>
          ) : existing.length === 0 ? (
            <div className="text-center py-8">
              <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-1">No questions added yet</p>
              <p className="text-sm text-gray-500">Add your first interview question below</p>
            </div>
          ) : (
            <div className="space-y-2">
              {existing.map((item, idx) => (
                <details key={idx} className="group border border-gray-200 rounded-lg overflow-hidden">
                  <summary className="list-none cursor-pointer p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-sm font-medium">
                          {idx + 1}
                        </span>
                        <span className="text-gray-900 font-medium">
                          {item.question}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                    {item.expectedAnswer?.trim() ? (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-900">
                            Expected Answer:
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 bg-white p-3 rounded border whitespace-pre-wrap">
                          {item.expectedAnswer}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-gray-500 italic">
                        No expected answer provided
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Questions Card */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-6">
            <Plus className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Add New Questions</h2>
          </div>

          {/* Mode Selection */}
          <div className="mb-6">
            <label className="form-label mb-3">Question Mode</label>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setMode('append')}
                className={`px-4 py-2 text-sm font-medium border-r border-gray-300 transition-colors ${
                  mode === 'append'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Append to existing
              </button>
              <button
                type="button"
                onClick={() => setMode('replace')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'replace'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Replace all questions
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {mode === 'append' 
                ? 'New questions will be added to existing ones'
                : 'All existing questions will be replaced with new ones'
              }
            </p>
          </div>

          {/* Question Input Forms */}
          <div className="space-y-4">
            {rows.map((r, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-sm font-medium">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      Question {idx + 1}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-red-600 hover:bg-red-100 transition-colors"
                    title="Remove this question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">
                      <HelpCircle className="w-4 h-4 inline mr-1" />
                      Interview Question
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., Explain the difference between debouncing and throttling"
                      value={r.question}
                      onChange={(e) => updateRow(idx, 'question', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label">
                      <FileText className="w-4 h-4 inline mr-1" />
                      Expected Answer{' '}
                      <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      className="form-input resize-none"
                      rows={3}
                      placeholder="Key points the candidate should cover in their answer..."
                      value={r.expectedAnswer ?? ''}
                      onChange={(e) =>
                        updateRow(idx, 'expectedAnswer', e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="form-error bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-red-400 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={addRow}
              className="btn-secondary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Question
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center">
                  <div className="loading-spinner mr-2 h-4 w-4"></div>
                  Saving...
                </div>
              ) : (
                <div className="flex items-center">
                  <Save className="w-4 h-4 mr-2" />
                  Save Questions
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

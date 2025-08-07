'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';


type Candidate = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

type QAItem = {
  question: string;
  answer: string;
};

export default function InterviewReportPage() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('candidateId');
  const candidateId = idParam;
  const router = useRouter();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [responses, setResponses] = useState<QAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId) {
      setError('Missing candidateId in URL');
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [candRes, respRes] = await Promise.all([
          fetch(`/api/candidates/${candidateId}`),
          fetch(`/api/reports/${candidateId}`)
        ]);

        if (!candRes.ok) {
          const { error: msg } = await candRes.json();
          throw new Error(msg || `Candidate fetch failed (${candRes.status})`);
        }
        if (!respRes.ok) {
          const { error: msg } = await respRes.json();
          throw new Error(msg || `Responses fetch failed (${respRes.status})`);
        }

        const { candidate } = await candRes.json();
        // our report route now returns { report: QAItem[] }
        const { report } = await respRes.json() as { report: QAItem[] };

        setCandidate(candidate);
        setResponses(report);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [candidateId]);

  if (loading) {
    return (
      <p className="p-8 text-center text-lg text-gray-600">Loading responses…</p>
    );
  }
  if (error || !candidate) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <p className="text-red-600 text-lg">
          {error || 'Unable to load data.'}
        </p>
      </div>
    );
  }

  const handleDownload = () => window.print();

    const handleGenerate = () => {
    if (candidateId) {
      router.push(`/onboarding/feedback?candidateId=${candidateId}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-16 p-8 bg-white rounded-2xl shadow-lg">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4 mb-8">
        <h1 className="text-3xl font-extrabold text-indigo-700">
          Interview Responses
        </h1>
       <div className="flex space-x-4">
        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-500 transition"
        >
          Generate Feedback
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-500 transition"
        >
          <Download size={18} /> Download
        </button>
      </div>
      </div>

      {/* Candidate Details */}
      <section className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Candidate Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <p>
            <span className="font-medium">Name:</span> {candidate.firstName}{' '}
            {candidate.lastName}
          </p>
          <p>
            <span className="font-medium">Email:</span> {candidate.email}
          </p>
          {candidate.phone && (
            <p>
              <span className="font-medium">Phone:</span> {candidate.phone}
            </p>
          )}
        </div>
      </section>

      {/* Interview Responses */}
      <section className="mb-8 bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Interview Responses
        </h2>
        <ul className="list-decimal list-inside space-y-6">
          {responses.map((item, idx) => (
            <li key={idx} className="space-y-2">
              <p className="font-medium text-gray-800">Q: {item.question}</p>
              <p className="text-gray-700 ml-4">
                A: {item.answer || <span className="italic text-gray-400">No answer provided</span>}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

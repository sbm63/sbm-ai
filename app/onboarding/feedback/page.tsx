// app/interviews/[candidateId]/feedback/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';

type QuestionFeedback = {
  question: string;
  answer: string;
  score: number;
  comment: string;
};

type Report = {
  overall_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  hire_recommendation: 'YES' | 'NO' | 'MAYBE';
  per_question: QuestionFeedback[];
};

export default function InterviewFeedbackPage() {
  const searchParams = useSearchParams();
  const candidateId = searchParams.get('candidateId');

  const [feedback, setFeedback] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId) {
      setError('Missing candidateId in URL');
      setLoading(false);
      return;
    }

    async function fetchFeedback() {
      try {
        const res = await fetch(`/api/reports/${candidateId}/feedback`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Fetch failed (${res.status})`);
        }
        const { report } = await res.json() as { report: Report };
        setFeedback(report);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFeedback();
  }, [candidateId]);

  const handleDownload = () => window.print();

  if (loading) {
    return (
      <p className="p-8 text-center text-lg text-gray-600">Generating feedback…</p>
    );
  }
  if (error) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <p className="text-red-600 text-lg">{error}</p>
      </div>
    );
  }
  if (!feedback) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto mt-16 p-8 bg-white rounded-2xl shadow-lg">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4 mb-8">
        <h1 className="text-3xl font-extrabold text-indigo-700">
          Interview Feedback
        </h1>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-500 transition"
        >
          <Download size={18} /> Download
        </button>
      </div>

      {/* Overall Feedback */}
      <section className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Overall Feedback
        </h2>
        <div className="mb-4">
          <span className="text-lg font-medium">Score:</span>
          <span className="ml-2 inline-block bg-indigo-100 text-indigo-700 font-semibold px-3 py-1 rounded-full">
            {feedback.overall_score}/100
          </span>
        </div>
        <p className="text-gray-700 mb-6">{feedback.summary}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-800 mb-2">Strengths</h3>
            <ul className="list-disc list-inside space-y-1">
              {feedback.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-800 mb-2">Improvements</h3>
            <ul className="list-disc list-inside space-y-1">
              {feedback.improvements.map((imp, i) => (
                <li key={i}>{imp}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-6">
          <span className="font-medium">Hire Recommendation:</span>
          <span
            className={`ml-2 inline-block px-3 py-1 rounded-full font-semibold ${
              feedback.hire_recommendation === 'YES'
                ? 'bg-green-100 text-green-700'
                : feedback.hire_recommendation === 'NO'
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {feedback.hire_recommendation}
          </span>
        </div>
      </section>

      {/* Per-Question Feedback */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">
          Per-Question Feedback
        </h2>
        <div className="space-y-6">
          {feedback.per_question.map((pq, idx) => (
            <div
              key={idx}
              className="bg-white border-l-4 border-indigo-500 rounded-lg shadow-sm p-6 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <span className="inline-block w-9 h-9 bg-indigo-500 text-white rounded-full flex items-center justify-center mr-4 text-lg font-semibold">
                    {idx + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {pq.question}
                  </h3>
                </div>
                <span className="font-bold text-gray-700">{pq.score}/10</span>
              </div>
              <p className="text-gray-700 italic mb-3">{pq.answer}</p>
              <p className="text-gray-800">{pq.comment}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

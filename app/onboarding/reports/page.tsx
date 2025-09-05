'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
  evaluation?: {
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
  };
};

type FinalEvaluation = {
  overallScore: number;
  recommendation: string;
  summary: string;
  detailedFeedback: {
    strengths: string[];
    weaknesses: string[];
    technicalSkills: string[];
    communicationSkills: string;
    problemSolving: string;
  };
  nextSteps: string;
  improvementAreas: string[];
  standoutMoments: string[];
};

export default function InterviewReportPage() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('candidateId');
  const candidateId = idParam;
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [responses, setResponses] = useState<QAItem[]>([]);
  const [finalEvaluation, setFinalEvaluation] =
    useState<FinalEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingFinal, setGeneratingFinal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId) {
      setError('Missing candidateId in URL');
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        // Get candidate info and interview responses
        const [candRes, interviewRes] = await Promise.all([
          fetch(`/api/candidates/${candidateId}`),
          fetch(`/api/interviews`, {
            method: 'GET',
            headers: candidateId ? { 'candidate-id': candidateId } : {},
          }),
        ]);

        if (!candRes.ok) {
          const { error: msg } = await candRes.json().catch(() => ({}));
          throw new Error(msg || `Candidate fetch failed (${candRes.status})`);
        }

        const { candidate } = await candRes.json();
        setCandidate(candidate);

        // Try to get interview responses
        if (interviewRes.ok) {
          const interviewData = await interviewRes.json();
          if (interviewData.interview?.responses) {
            setResponses(interviewData.interview.responses);
          }
        }

        // Try to get existing final evaluation
        try {
          const evalRes = await fetch(
            `/api/interviews/final-evaluation?candidateId=${candidateId}`,
          );
          if (evalRes.ok) {
            const evalData = await evalRes.json();
            if (evalData.evaluation) {
              setFinalEvaluation(evalData.evaluation);
            }
          }
        } catch (e) {
          console.log('No existing final evaluation found');
        }
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
      <p className="p-8 text-center text-lg text-gray-600">
        Loading responses…
      </p>
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

  const generateFinalEvaluation = async () => {
    if (!candidateId || generatingFinal) return;

    try {
      setGeneratingFinal(true);
      const response = await fetch('/api/interviews/final-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate final evaluation');
      }

      const data = await response.json();
      setFinalEvaluation(data.evaluation);
    } catch (error: any) {
      setError(error.message || 'Failed to generate evaluation');
    } finally {
      setGeneratingFinal(false);
    }
  };

  // Removed unused handleGenerate function

  // Calculate average score from responses
  const averageScore =
    responses.length > 0
      ? responses.reduce(
          (acc, item) => acc + (item.evaluation?.score || 5),
          0,
        ) / responses.length
      : 0;

  return (
    <div className="max-w-4xl mx-auto mt-16 p-8 bg-white rounded-2xl shadow-lg">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4 mb-8">
        <h1 className="text-3xl font-extrabold text-indigo-700">
          AI Interview Report
        </h1>
        <div className="flex space-x-4">
          {!finalEvaluation && (
            <button
              onClick={generateFinalEvaluation}
              disabled={generatingFinal || responses.length === 0}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-500 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {generatingFinal ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                'Generate Final Evaluation'
              )}
            </button>
          )}
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

      {/* Final AI Evaluation */}
      {finalEvaluation && (
        <section className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Final AI Evaluation
            </h2>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Overall Score</p>
                <p className="text-3xl font-bold text-blue-600">
                  {finalEvaluation.overallScore}/10
                </p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  finalEvaluation.recommendation === 'hire'
                    ? 'bg-green-100 text-green-800'
                    : finalEvaluation.recommendation === 'maybe'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {finalEvaluation.recommendation.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-green-700 mb-2">Strengths</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {finalEvaluation.detailedFeedback.strengths.map(
                  (strength, idx) => (
                    <li key={idx}>{strength}</li>
                  ),
                )}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-red-700 mb-2">
                Areas for Improvement
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {finalEvaluation.detailedFeedback.weaknesses.map(
                  (weakness, idx) => (
                    <li key={idx}>{weakness}</li>
                  ),
                )}
              </ul>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold text-gray-800 mb-2">Summary</h3>
            <p className="text-gray-700">{finalEvaluation.summary}</p>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold text-gray-800 mb-2">Next Steps</h3>
            <p className="text-gray-700">{finalEvaluation.nextSteps}</p>
          </div>

          {finalEvaluation.standoutMoments.length > 0 && (
            <div>
              <h3 className="font-semibold text-blue-700 mb-2">
                Standout Moments
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {finalEvaluation.standoutMoments.map((moment, idx) => (
                  <li key={idx}>{moment}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Interview Responses */}
      <section className="mb-8 bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">
            Interview Responses
          </h2>
          {averageScore > 0 && (
            <p className="text-sm text-gray-600">
              Average Score:{' '}
              <span className="font-bold text-blue-600">
                {averageScore.toFixed(1)}/10
              </span>
            </p>
          )}
        </div>

        {responses.length === 0 ? (
          <p className="text-gray-500 italic">No interview responses found.</p>
        ) : (
          <div className="space-y-8">
            {responses.map((item, idx) => (
              <div key={idx} className="border-l-4 border-blue-200 pl-6 pb-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-gray-800 text-lg">
                    Question {idx + 1}
                  </h3>
                  {item.evaluation && (
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          item.evaluation.score >= 7
                            ? 'bg-green-100 text-green-800'
                            : item.evaluation.score >= 5
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.evaluation.score}/10
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-gray-700 mb-3 font-medium">
                  {item.question}
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <p className="text-gray-800">
                    {item.answer || (
                      <span className="italic text-gray-400">
                        No answer provided
                      </span>
                    )}
                  </p>
                </div>

                {item.evaluation && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">
                      AI Feedback
                    </h4>
                    <p className="text-sm text-blue-700 mb-2">
                      {item.evaluation.feedback}
                    </p>
                    {item.evaluation.strengths.length > 0 && (
                      <p className="text-xs text-green-600">
                        <span className="font-medium">Strengths:</span>{' '}
                        {item.evaluation.strengths.join(', ')}
                      </p>
                    )}
                    {item.evaluation.improvements.length > 0 && (
                      <p className="text-xs text-orange-600">
                        <span className="font-medium">Improvements:</span>{' '}
                        {item.evaluation.improvements.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

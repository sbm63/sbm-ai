'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

type Feedback = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
};

export default function StartInterviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const candidateId = idParam!;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [meetingJoined, setMeetingJoined] = useState(false);

  useEffect(() => {
    if (!candidateId) {
      setError('No candidate ID provided');
      setLoading(false);
      return;
    }

    fetch(`/api/candidates/${candidateId}`)
      .then(async (res) => {
        if (!res.ok) {
          const { error } = await res.json();
          throw new Error(error || `Status ${res.status}`);
        }
        return res.json();
      })
      .then(({ candidate }) => setCandidate(candidate))
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [candidateId]);

  const handleValidate = async () => {
    if (validated) return;
    setValidating(true);
    setError(null);
    try {
      const res = await fetch(`/api/start-interview/${candidateId}`);
      const data = await res.json();

      if (data.feedback) {
        setFeedback(data.feedback);
        setValidated(true);
      } else {
        throw new Error(data.message || 'Validation failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  };

  const handleJoinMeeting = () => {
    setMeetingJoined(true);
    window.open('https://meet.google.com/your-meet-link', '_blank');
  };

  const handleStart = () => {
    router.push(`/onboarding?candidateId=${candidateId}`);
  };

  if (loading) {
    return <p className="p-6 text-center">Loading candidate…</p>;
  }

  if (error || !candidate) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <p className="text-red-600">{error || 'Candidate not found.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-lg shadow relative">
      {/* Join Meet button */}
      <div className="absolute top-4 right-4">
        <button
          onClick={handleJoinMeeting}
          disabled={meetingJoined}
          className={`py-2 px-4 rounded-md font-medium transition ${
            meetingJoined
              ? 'bg-green-500 text-white cursor-default'
              : 'bg-purple-600 text-white hover:bg-purple-500'
          }`}
        >
          {meetingJoined ? 'Meeting Joined' : 'Join Meet'}
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-4">Start Interview</h1>

      {/* Candidate info */}
      <div className="space-y-2 mb-6 text-left">
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

      {/* Error message */}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleValidate}
          disabled={validating || validated}
          className={`flex-1 py-2 rounded-md font-medium transition ${
            validated
              ? 'bg-green-500 text-white cursor-default'
              : validating
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {validated
            ? 'Resume Validated'
            : validating
            ? 'Validating...'
            : 'Validate Resume'}
        </button>

        <button
          onClick={handleStart}
          className={`flex-1 py-2 rounded-md font-medium transition ${
            meetingJoined
              ? 'bg-green-600 text-white hover:bg-green-500'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
        >
          Start Interview
        </button>
      </div>

      {/* 📄 Feedback Card */}
      {feedback && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h2 className="text-xl font-semibold mb-2">Feedback Summary</h2>
          <p className="mb-4">{feedback.summary}</p>

          <div className="mb-4">
            <h3 className="font-medium">Strengths:</h3>
            <ul className="list-disc list-inside pl-4">
              {feedback.strengths.length > 0 ? (
                feedback.strengths.map((s, i) => <li key={i}>{s}</li>)
              ) : (
                <li className="text-gray-500">None identified.</li>
              )}
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="font-medium">Weaknesses:</h3>
            <ul className="list-disc list-inside pl-4">
              {feedback.weaknesses.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-medium">Recommendation:</h3>
            <p>{feedback.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

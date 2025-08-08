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

type JobProfile = {
  id: string;
  title: string; // display name
  role?: string; // optional
  createdAt?: string;
};

export default function StartInterviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const candidateId = idParam!;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [meetingJoined, setMeetingJoined] = useState(false);

  // Load candidate
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

  // Load job profiles — expects { jobs: JobProfile[] }
  useEffect(() => {
    setProfilesLoading(true);
    setProfilesError(null);
    fetch('/api/job-profiles')
      .then(async (res) => {
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({}));
          throw new Error(error || `Status ${res.status}`);
        }
        return res.json();
      })
      .then(({ jobs }: { jobs: JobProfile[] }) => {
        const list = jobs || [];
        setProfiles(list);
        if (list.length === 1) {
          setSelectedProfileId(list[0].id); // auto-select if only one
        }
      })
      .catch((err: any) => setProfilesError(err.message))
      .finally(() => setProfilesLoading(false));
  }, []);

  const handleValidate = async () => {
    if (validated) return;
    if (!selectedProfileId) {
      setError('Please select a job profile before validating.');
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/start-interview/${candidateId}?profileId=${encodeURIComponent(
          selectedProfileId,
        )}`,
      );
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
    if (!selectedProfileId) {
      setError('Please select a job profile to start the interview.');
      return;
    }
    return router.push(
      `/onboarding?candidateId=${candidateId}&profileId=${selectedProfileId}`,
    );
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

  const canValidate = !!selectedProfileId && !validating && !validated;
  const canStart = !!selectedProfileId;

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

      {/* Job Profile dropdown */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">Job Profile</label>
        <select
          value={selectedProfileId}
          onChange={(e) => {
            setSelectedProfileId(e.target.value);
            setValidated(false);
            setFeedback(null);
          }}
          className="w-full border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={profilesLoading}
        >
          <option value="">
            {profilesLoading ? 'Loading profiles…' : 'Select a profile'}
          </option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        {profilesError && <p className="text-red-600 mt-2">{profilesError}</p>}
      </div>

      {/* Error message */}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleValidate}
          disabled={!canValidate}
          className={`flex-1 py-2 rounded-md font-medium transition ${
            validated
              ? 'bg-green-500 text-white cursor-default'
              : canValidate
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
        >
          {validated
            ? 'Resume Validated'
            : validating
            ? 'Validating…'
            : 'Validate Resume'}
        </button>

        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`flex-1 py-2 rounded-md font-medium transition ${
            canStart
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

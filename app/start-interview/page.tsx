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
      `/onboarding?candidateId=${candidateId}&jobId=${selectedProfileId}`,
    );
  };

  if (loading) {
    return (
      <div className="custom-screen py-8">
        <div className="card max-w-md mx-auto">
          <div className="card-body text-center py-12">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-gray-600">Loading candidate information...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="custom-screen py-8">
        <div className="card max-w-md mx-auto">
          <div className="card-body text-center py-12">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-red-600 font-medium">
              {error || 'Candidate not found.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const canValidate = !!selectedProfileId && !validating && !validated;
  const canStart = !!selectedProfileId;

  return (
    <div className="custom-screen py-8">
      <div className="max-w-4xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Start Interview</h1>
            <p className="page-subtitle">
              Configure and begin the interview process
            </p>
          </div>
          <button
            onClick={handleJoinMeeting}
            disabled={meetingJoined}
            className={meetingJoined ? 'btn-success' : 'btn-secondary'}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {meetingJoined ? 'Meeting Joined' : 'Join Video Call'}
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Candidate Information Card */}
          <div className="lg:col-span-1">
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Candidate Information
                </h2>
              </div>
              <div className="card-body space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">
                      {candidate.firstName.charAt(0)}
                      {candidate.lastName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {candidate.firstName} {candidate.lastName}
                    </h3>
                    <p className="text-gray-600 text-sm">Candidate</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-gray-600">
                    <svg
                      className="w-4 h-4 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <a
                      href={`mailto:${candidate.email}`}
                      className="hover:text-indigo-600 transition-colors"
                    >
                      {candidate.email}
                    </a>
                  </div>
                  {candidate.phone && (
                    <div className="flex items-center text-gray-600">
                      <svg
                        className="w-4 h-4 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      <a
                        href={`tel:${candidate.phone}`}
                        className="hover:text-indigo-600 transition-colors"
                      >
                        {candidate.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Interview Setup Card */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Interview Configuration
                </h2>
              </div>
              <div className="card-body space-y-6">
                <div>
                  <label htmlFor="jobProfile" className="form-label">
                    <svg
                      className="w-4 h-4 inline mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6"
                      />
                    </svg>
                    Job Profile
                  </label>
                  <select
                    id="jobProfile"
                    value={selectedProfileId}
                    onChange={(e) => {
                      setSelectedProfileId(e.target.value);
                      setValidated(false);
                      setFeedback(null);
                    }}
                    className="form-input"
                    disabled={profilesLoading}
                  >
                    <option value="">
                      {profilesLoading
                        ? 'Loading profiles…'
                        : 'Select a job profile'}
                    </option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  {profilesError && (
                    <p className="form-error">{profilesError}</p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
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
                      <p className="text-red-600 font-medium">{error}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={handleValidate}
                    disabled={!canValidate}
                    className={`flex-1 ${
                      validated
                        ? 'btn-success cursor-default'
                        : canValidate
                        ? 'btn-secondary'
                        : 'btn-secondary opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      {validated ? (
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      ) : validating ? (
                        <div className="loading-spinner mr-2 h-4 w-4"></div>
                      ) : (
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      )}
                      {validated
                        ? 'Resume Validated'
                        : validating
                        ? 'Validating…'
                        : 'Validate Resume'}
                    </div>
                  </button>

                  <button
                    onClick={handleStart}
                    disabled={!canStart}
                    className={`flex-1 ${
                      canStart
                        ? 'btn-primary'
                        : 'btn-primary opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a2 2 0 002 2h2a2 2 0 002-2v-4M9 10V8a2 2 0 012-2h2a2 2 0 012 2v2"
                        />
                      </svg>
                      Start Interview
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Card */}
        {feedback && (
          <div className="mt-8">
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Resume Analysis Results
                </h2>
              </div>
              <div className="card-body">
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
                  <p className="text-gray-700">{feedback.summary}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-semibold text-green-800 mb-3 flex items-center">
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Strengths
                    </h3>
                    <ul className="space-y-2">
                      {feedback.strengths.length > 0 ? (
                        feedback.strengths.map((s, i) => (
                          <li key={i} className="flex items-start">
                            <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                            <span className="text-gray-700">{s}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500 italic">
                          None identified.
                        </li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-orange-800 mb-3 flex items-center">
                      <svg
                        className="w-4 h-4 mr-2"
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
                      Areas for Improvement
                    </h3>
                    <ul className="space-y-2">
                      {feedback.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start">
                          <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                          <span className="text-gray-700">{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    Recommendation
                  </h3>
                  <p className="text-blue-800">{feedback.recommendation}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

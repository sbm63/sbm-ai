'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateCandidatePage() {
  const router = useRouter();

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setResumeFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) {
      setError('Please upload a PDF resume');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);

      const res = await fetch('/api/candidates?smart=true', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || `Error: ${res.status}`);
      }

      router.push('/candidates');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="custom-screen py-8">
      <div className="max-w-2xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Upload Resume</h1>
            <p className="page-subtitle">
              AI-powered candidate creation from resume
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="text-center mb-8">
              <div className="mx-auto h-16 w-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="h-8 w-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Smart Resume Processing
              </h3>
              <p className="text-gray-600">
                Upload a resume and our AI will automatically extract candidate
                information and create their profile
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="resume" className="form-label">
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Resume Document
                </label>

                <div className="mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-gray-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors group">
                  <div className="space-y-3 text-center">
                    <svg
                      className="mx-auto h-16 w-16 text-gray-400 group-hover:text-indigo-500 transition-colors"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <div className="text-center">
                      <label
                        htmlFor="resume"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span className="text-base">Upload a resume</span>
                        <input
                          type="file"
                          id="resume"
                          accept="application/pdf"
                          onChange={handleFileChange}
                          required
                          className="sr-only"
                        />
                      </label>
                      <p className="text-gray-500">or drag and drop</p>
                    </div>

                    <p className="text-sm text-gray-500">PDF up to 10MB</p>

                    {resumeFile && (
                      <div className="mt-4 flex items-center justify-center text-sm text-green-600 bg-green-50 rounded-lg p-3">
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="font-medium">{resumeFile.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-blue-500 mt-0.5 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 mb-1">
                        How it works
                      </h4>
                      <p className="text-sm text-blue-700">
                        Our AI will analyze the resume and automatically extract
                        candidate information including name, email, phone,
                        skills, and experience to create their profile.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="form-error bg-red-50 border border-red-200 rounded-lg p-3">
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

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !resumeFile}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="loading-spinner mr-2 h-4 w-4"></div>
                      Processing Resume...
                    </div>
                  ) : (
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Create Candidate from Resume
                    </div>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

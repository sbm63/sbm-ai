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
    <div className="max-w-lg mx-auto mt-12 p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Upload Resume</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="resume" className="block text-sm font-medium mb-1">
            Resume (PDF)
          </label>
          <input
            type="file"
            id="resume"
            accept="application/pdf"
            onChange={handleFileChange}
            required
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-sm text-gray-600 mt-1">
            Upload a resume and we&apos;ll extract candidate details automatically
          </p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Processing Resume...' : 'Create Candidate from Resume'}
        </button>
      </form>
    </div>
  );
}

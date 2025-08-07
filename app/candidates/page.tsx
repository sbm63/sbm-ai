'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Candidate = {
  id:string;
  candidateId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

export default function CandidatesPage() {
  const router = useRouter();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/candidates')
      .then((res) => res.json())
      .then((data) => {
        if (data.candidates && data.candidates.length > 0) {
          setCandidates(data.candidates);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto mt-12 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Candidates</h1>
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/job-profiles')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500"
          >
            Find Jobs
          </button>
          <button
            onClick={() => router.push('/candidates/create-candidate')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500"
          >
            New Candidate
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="shadow border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  First Name
                </th>
                <th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Name
                </th>
                <th className="w-2/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {candidates.map((cand, idx) => (
                <tr
                  key={cand.id}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {cand.firstName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {cand.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {cand.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {cand.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() =>
                        router.push(
                          `/start-interview?id=${cand.id}`,
                        )
                      }
                      className="text-indigo-600 hover:text-indigo-900  border-2 px-1"
                    >
                      Interview
                    </button>
                    <button
                      onClick={() =>
                        router.push(
                          `/onboarding/reports?candidateId=${cand.id}`,
                        )
                      }
                      className="ms-2 text-indigo-600 hover:text-indigo-900 border-2 px-1"
                    >
                    Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

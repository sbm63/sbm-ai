'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

export default function JobProfilesPage() {
  const router = useRouter();

  type JobProfile = {
    id:string;
    title: string;
    department: string;
    location: string;
    type: string;
    salary: string;
  };

  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/job-profiles')
      .then((res) => res.json())
      .then((data) => {
        if (data.jobs && data.jobs.length > 0) setJobs(data.jobs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="custom-screen py-8">
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Profiles</h1>
          <p className="page-subtitle">Manage job roles and interview criteria</p>
        </div>
        <button
          onClick={() => router.push('/job-profiles/create-job-profile')}
          className="btn-success"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create New Profile
        </button>
      </div>

      {loading ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-gray-600">Loading job profiles...</p>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="table-header">
              <tr>
                <th className="table-cell-header w-1/5">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6" />
                    </svg>
                    Title
                  </div>
                </th>
                <th className="table-cell-header w-1/5">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Department
                  </div>
                </th>
                <th className="table-cell-header w-1/5">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Location
                  </div>
                </th>
                <th className="table-cell-header w-1/5">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Type
                  </div>
                </th>
                <th className="table-cell-header w-1/5">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Salary
                  </div>
                </th>
                <th className="table-cell-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-12 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6" />
                    </svg>
                    No job profiles found. Create your first job profile to get started.
                  </td>
                </tr>
              ) : (
                jobs.map((job, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}
                  >
                    <td className="table-cell font-medium text-gray-900">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                          <span className="text-white font-semibold text-sm">
                            {job.title.charAt(0)}
                          </span>
                        </div>
                        {job.title}
                      </div>
                    </td>
                    <td className="table-cell text-gray-700">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {job.department}
                      </span>
                    </td>
                    <td className="table-cell text-gray-700">
                      <div className="flex items-center">
                        <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {job.location}
                      </div>
                    </td>
                    <td className="table-cell text-gray-700">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        job.type.toLowerCase().includes('full') 
                          ? 'bg-green-100 text-green-800'
                          : job.type.toLowerCase().includes('part')
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {job.type}
                      </span>
                    </td>
                    <td className="table-cell text-gray-700 font-medium">
                      {job.salary}
                    </td>
                    <td className="table-cell text-right">
                      <button
                        onClick={() =>
                          router.push(
                            `/job-profiles/questions?id=${job.id}`,
                          )
                        }
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors duration-200"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Questions
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

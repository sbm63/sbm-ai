'use client';

import React, { useState } from 'react';
import CreatableSelect from '@/node_modules/react-select/creatable/distelect/creatable/dist';
import Link from 'next/link';

type Option = { label: string; value: string };

const initialOptions: Option[] = [
  { label: 'Recruiter', value: 'recruiter' },
  { label: 'Candidate', value: 'candidate' },
  { label: 'Admin', value: 'admin' },
];

export default function SelectRole() {
  const [options, setOptions] = useState<Option[]>(initialOptions);
  const [selected, setSelected] = useState<Option | null>(null);

  const handleCreate = (input: string) => {
    const newOpt = {
      label: input,
      value: input.toLowerCase().replace(/\s+/g, '-'),
    };
    setOptions((prev) => [...prev, newOpt]);
    setSelected(newOpt);
  };

  return (
    <div className="mt-20 mx-auto max-w-md px-4 text-center">
      <h2 className="text-3xl font-bold mb-4">Select Role</h2>
      <p className="mb-6 text-gray-700">
        Choose the role you’d like to be interviewed for
      </p>

      <CreatableSelect
        isClearable
        options={options}
        value={selected}
        onChange={(opt) => setSelected(opt as Option)}
        onCreateOption={handleCreate}
        placeholder="Type or select a role…"
      />

      <Link
        href={`/onboarding${selected ? `?role=${selected.value}` : ''}`}
        scroll={false}
        className={`
          mt-8 inline-block px-6 py-3 rounded-lg font-medium 
          ${
            selected
              ? 'bg-gray-800 text-white hover:bg-gray-700'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }
        `}
        aria-disabled={!selected}
      >
        Start Interview
      </Link>
    </div>
  );
}

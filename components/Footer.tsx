'use client';

import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer>
      <div className="custom-screen mx-auto mt-10 px-4">
        <div className=" py-4 border-t flex flex-col md:flex-row items-center justify-between">
          <p className="text-gray-600 text-sm">
            © {year} Diskiao AI. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 flex space-x-6">
            <Link href="/privacy" className="text-gray-600 hover:underline text-sm">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-gray-600 hover:underline text-sm">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

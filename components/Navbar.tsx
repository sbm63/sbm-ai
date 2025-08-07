'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import NavLink from './NavLink';
import Image from 'next/image';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

const Navbar = () => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const navigation = [
    { title: 'Schedule Demo', path: '/' },
    { title: 'View Demo Dashboard', path: '/' },
    { title: 'Candidates', path: '/candidates' },
    { title: 'Job Profiles', path: '/job-profiles' },
  ];

  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    document.body.classList.remove('overflow-hidden');
    setMenuOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileMenuOpen &&
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [profileMenuOpen]);

  const handleNavMenu = () => {
    setMenuOpen(!menuOpen);
    document.body.classList.toggle('overflow-hidden');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    router.push('/login');
  };

  return (
    <header className="border">
      <nav
        className={`bg-white w-full md:static md:text-sm ${
          menuOpen ? 'fixed z-10 h-full' : ''
        }`}
      >
        <div className="custom-screen items-center mx-auto md:flex">
          {/* Logo & mobile toggle */}
          <div className="flex items-center justify-between py-3 md:py-5 md:block">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/box.svg" alt="logo" width={30} height={30} />
              <div className="font-bold text-lg">Diskiao AI</div>
            </Link>
            <div className="md:hidden">
              <button
                role="button"
                aria-label="Toggle menu"
                className="text-gray-500 hover:text-gray-800"
                onClick={handleNavMenu}
              >
                {menuOpen ? (
                  /* X icon */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  /* Hamburger icon */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Nav links + auth */}
          <div
            className={`flex-1 pb-3 mt-8 md:pb-0 md:mt-0 md:block ${
              menuOpen ? '' : 'hidden'
            }`}
          >
            <ul className="text-gray-700 justify-end items-center space-y-6 md:flex md:space-x-6 md:space-y-0 md:text-gray-600 md:font-medium">
              {isLoggedIn &&
                navigation.map((item, idx) => (
                  <li key={idx} className="duration-150 hover:text-gray-900">
                    <Link href={item.path} className="block">
                      {item.title}
                    </Link>
                  </li>
                ))}

              {!isLoggedIn ? (
                <li>
                  <NavLink
                    href="/login"
                    className="block font-medium text-xs text-blue-600 bg-transparent border border-blue-600 hover:bg-blue-50 active:bg-blue-100 md:inline px-3 py-1.5 rounded"
                  >
                    Login
                  </NavLink>
                </li>
              ) : (
                <li className="relative">
                  <div ref={profileMenuRef}>
                    {' '}
                    <button
                      onClick={() => setProfileMenuOpen((prev) => !prev)}
                      className="flex items-center space-x-1 font-medium text-gray-700 hover:text-gray-900 md:inline px-4 py-2 rounded hover:bg-gray-100"
                    >
                      {/* User avatar icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 2a5 5 0 100 10 5 5 0 000-10zM2 18a8 8 0 0116 0H2z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>

                  {profileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-20">
                      <ul className="flex flex-col">
                        <li>
                          <Link
                            href="/profile"
                            className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            Profile
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/about"
                            className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            About
                          </Link>
                        </li>
                        <li>
                          <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                          >
                            Logout
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;

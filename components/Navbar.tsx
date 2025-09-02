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
  }, []);

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

  const handleLogout = async () => {
    try {
      await fetch('/api/user/logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
    } catch (e) {
      // optional: console.error(e);
    } finally {
      setIsLoggedIn(false); // if you still track this locally
      router.replace('/login');
      router.refresh(); // ensures UI re-renders without auth
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50 backdrop-blur-md bg-white/95">
      <nav
        className={`w-full md:static md:text-sm ${
          menuOpen ? 'fixed z-10 h-full bg-white' : ''
        }`}
      >
        <div className="custom-screen items-center mx-auto md:flex">
          {/* Logo & mobile toggle */}
          <div className="flex items-center justify-between py-4 md:py-5 md:block">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg group-hover:shadow-xl transition-all duration-200">
                <Image src="/box.svg" alt="logo" width={24} height={24} className="filter brightness-0 invert" />
              </div>
              <div className="font-bold text-xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Diskiao AI
              </div>
            </Link>
            <div className="md:hidden">
              <button
                role="button"
                aria-label="Toggle menu"
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                onClick={handleNavMenu}
              >
                {menuOpen ? (
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
            <ul className="text-gray-700 justify-end items-center space-y-6 md:flex md:space-x-2 md:space-y-0 md:text-gray-600 md:font-medium">
              {isLoggedIn &&
                navigation.map((item, idx) => (
                  <li key={idx}>
                    <Link 
                      href={item.path} 
                      className="block px-4 py-2 rounded-lg hover:bg-gray-100 hover:text-indigo-600 transition-all duration-200 font-medium"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}

              {!isLoggedIn ? (
                <li>
                  <NavLink
                    href="/login"
                    className="btn-outline text-sm"
                  >
                    Login
                  </NavLink>
                </li>
              ) : (
                <li className="relative">
                  <div ref={profileMenuRef}>
                    <button
                      onClick={() => setProfileMenuOpen((prev) => !prev)}
                      className="flex items-center space-x-2 font-medium text-gray-700 hover:text-indigo-600 md:inline px-4 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                    >
                      <div className="p-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 2a5 5 0 100 10 5 5 0 000-10zM2 18a8 8 0 0116 0H2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>

                  {profileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 card shadow-xl z-20">
                      <ul className="flex flex-col py-2">
                        <li>
                          <Link
                            href="/profile"
                            className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors duration-200 font-medium"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <div className="flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>Profile</span>
                            </div>
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/about"
                            className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors duration-200 font-medium"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <div className="flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>About</span>
                            </div>
                          </Link>
                        </li>
                        <hr className="my-1 border-gray-200" />
                        <li>
                          <button
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 transition-colors duration-200 font-medium"
                          >
                            <div className="flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                              <span>Logout</span>
                            </div>
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

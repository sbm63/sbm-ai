'use client';

import Image from 'next/image';
import NavLink from './NavLink';

let heroImages = [
  '/ai1.jpg',
  '/ai2.png',
  '/ai4.jpeg',
  '/ai5.jpeg',
  '/ai6.jpeg',
];

export default function HomePage() {
  return (
    <section>
      <div className="custom-screen pt-10 text-gray-600">
        {/* Top section: Text (60%) and 2 images (40%) */}
        <div className="flex flex-col lg:flex-row lg:items-center items-start gap-10">
          {/* Left: Text */}
          <div className="lg:w-3/5 space-y-5">
            <h1 className="text-4xl text-gray-800 font-extrabold sm:text-6xl leading-tight">
              Transform Your Hiring Process with <span className="text-indigo-600">Diskiao AI</span>
            </h1>
            <h5 className="max-w-xl text-lg text-gray-700">
              AI that elevates recruiters—working with you, not replacing you.
            </h5>

            <p className="max-w-xl text-gray-600">
              Streamline your technical interviews with Diskiao AI’s advanced platform.
              Get instant insights, comprehensive evaluations, and make data-driven
              hiring decisions.
            </p>

            <div className="flex flex-wrap items-center gap-x-3 font-medium text-sm">
              <NavLink
                href="/candidates"
                className="px-5 py-2 rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 shadow-md"
              >
                Start Screening Candidates
              </NavLink>
              <NavLink
                href="/select-role"
                className="px-5 py-2 rounded-lg text-gray-700 border hover:bg-gray-50 shadow-sm"
                scroll={false}
              >
                Book a Demo
              </NavLink>
            </div>
          </div>

          {/* Right: First 2 images stacked vertically */}
          <div className="lg:w-2/5 flex flex-col gap-4">
            {heroImages.slice(0, 2).map((image, idx) => (
              <div
                key={idx}
                className="relative h-56 w-full overflow-hidden rounded-lg shadow-lg hover:scale-[1.02] transition-transform duration-300"
              >
                <Image
                  alt="image"
                  src={image}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Remaining 3 images + context */}
        <div className="mt-16">
          <div className="grid sm:grid-cols-3 grid-cols-1 gap-6">
            {heroImages.slice(2).map((image, idx) => (
              <div
                key={idx}
                className="relative h-48 w-full overflow-hidden rounded-lg shadow-md hover:scale-[1.02] transition-transform duration-300"
              >
                <Image
                  alt="image"
                  src={image}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          <p className="mt-8 text-center max-w-2xl mx-auto text-gray-700 text-lg">
            Our platform empowers recruiters with <span className="font-semibold text-indigo-600">AI-driven insights</span>, 
            enabling faster, fairer, and more accurate hiring decisions. From resume 
            screening to final feedback, Diskiao AI streamlines your process end to end.
          </p>
        </div>
      </div>
    </section>
  );
}

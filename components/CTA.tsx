import NavLink from './NavLink';

const CTA = () => (
  <SectionWrapper>
    <div className="custom-screen">
      <div className="max-w-2xl mx-auto text-center">
        <h2
          className="text-gray-800 text-3xl font-semibold sm:text-4xl"
          id="oss"
        >
          Ready to Improve Your Hiring Process?
        </h2>
        <p className="mt-3 text-gray-600">
          Join leading recruiters who use Diskiao AI to make confident hiring
          decisions
        </p>
        <NavLink
          href="\"
          className="mt-4 inline-flex justify-center items-center gap-2 font-medium text-sm text-white bg-gray-800 hover:bg-gray-600 active:bg-gray-900 max-w-[200px] py-2.5 px-4 text-center rounded-lg duration-150"
        >
          <span>Start Screening Now</span>
        </NavLink>
      </div>
    </div>
  </SectionWrapper>
);

const SectionWrapper = ({ children, ...props }: any) => (
  <section {...props} className={`py-16 ${props.className || ''}`}>
    {children}
  </section>
);

export default CTA;

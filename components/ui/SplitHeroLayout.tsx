export function SplitHeroLayout({
  left,
  right,
}: {
  left: React.ReactNode
  right: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen w-screen flex-col overflow-x-hidden bg-bg md:h-screen md:flex-row md:overflow-hidden">
      {/* Pink panel — compact top band on mobile, 38% column on desktop */}
      <div className="flex flex-col bg-accent px-6 py-6 md:w-[38%] md:min-w-[38%] md:px-10 md:py-12">
        {left}
      </div>
      {/* White panel — content sits at top on mobile, vertically centered on desktop */}
      <div className="flex w-full flex-col items-center justify-start bg-bg px-6 py-8 md:w-auto md:flex-1 md:justify-center md:p-12">
        {right}
      </div>
    </div>
  )
}

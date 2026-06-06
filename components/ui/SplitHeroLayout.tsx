export function SplitHeroLayout({
  left,
  right,
}: {
  left: React.ReactNode
  right: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <div
        style={{
          width: '38%',
          minWidth: '38%',
          backgroundColor: 'var(--color-accent)',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 40px',
        }}
      >
        {left}
      </div>
      <div
        style={{
          flex: 1,
          backgroundColor: 'var(--color-bg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
        }}
      >
        {right}
      </div>
    </div>
  )
}

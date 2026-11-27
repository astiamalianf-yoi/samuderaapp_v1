export function Header() {
  return (
    <header 
      className="p-4 font-bold text-xl text-white shadow flex items-center justify-center"
      style={{
        paddingTop: 'calc(1rem + var(--safe-area-inset-top))',
        backgroundColor: '#0077ff'
      }}
    >
      <h1>SAMUDRA</h1>
    </header>
  )
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline"
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base = "px-4 py-2 rounded-xl font-medium hw-accelerate touch-optimize"
  const styles = {
    primary: "bg-primary text-white hover:bg-primary/90",
    secondary: "bg-secondary text-white hover:bg-secondary/90",
    outline: "border border-primary text-primary hover:bg-primary/10"
  }
  return (
    <button 
      className={`${base} ${styles[variant]} ${className}`} 
      style={{
        transition: 'background-color 0.2s ease-out, transform 0.15s ease-out',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)'
      }}
      {...props} 
    />
  )
}

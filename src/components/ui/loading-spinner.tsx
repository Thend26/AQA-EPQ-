type LoadingSpinnerProps = {
  size?: "sm" | "md";
  className?: string;
};

export function LoadingSpinner({
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`loading-spinner loading-spinner-${size} ${className}`.trim()}
      data-testid="loading-spinner"
    />
  );
}

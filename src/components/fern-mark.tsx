type FernMarkProps = {
  size?: number;
  className?: string;
};

export function FernMark({ size = 22, className }: FernMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      >
        <path d="M7 20C8.5 14.5 12 9.5 18.5 4.5" />
        <path d="M8.9 15.2Q6.2 13.8 5.2 10.8" />
        <path d="M8.9 15.2Q12.2 15.6 15.5 14.2" />
        <path d="M11.5 11.3Q9.1 9.9 8.4 7.1" />
        <path d="M11.5 11.3Q14.4 11.6 17.3 10.2" />
        <path d="M14.6 7.8Q13 6.6 12.7 4.4" />
        <path d="M14.6 7.8Q16.8 8 19 6.8" />
      </g>
    </svg>
  );
}

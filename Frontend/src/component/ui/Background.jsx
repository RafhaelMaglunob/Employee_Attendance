import React from 'react';

function Background() {
  return (
    <svg
      className="fixed inset-0 w-full h-full -z-10 pointer-events-none"
      viewBox="0 0 1920 952"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
    >
      <rect width="1920" height="952" fill="white" />
      <rect width="1920" height="952" fill="#FFFDF4" />
      <rect width="1920" height="952" fill="url(#pattern0_2502_300)" />
      <rect width="1920" height="952" fill="url(#paint0_linear_2502_300)" />
      <rect width="1920" height="952" fill="url(#paint1_linear_2502_300)" />
      <defs>
        <linearGradient
          id="paint0_linear_2502_300"
          x1="960"
          y1="952"
          x2="960"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFDF4" stopOpacity="0" />
          <stop offset="0.490385" stopColor="#FFFDF4" />
        </linearGradient>
        <linearGradient
          id="paint1_linear_2502_300"
          x1="960"
          y1="476"
          x2="960"
          y2="952"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFDF4" stopOpacity="0" />
          <stop offset="1" stopColor="#FFC629" stopOpacity="0.9" />
        </linearGradient>
        <pattern
          id="pattern0_2502_300"
          patternUnits="userSpaceOnUse"
          patternTransform="matrix(30 0 0 60 950 466)"
          preserveAspectRatio="none"
          viewBox="0 0 30 60"
          width="1"
          height="1"
        >
          <use xlinkHref="#pattern0_2502_300_inner" transform="translate(-30 0)" />
          <g id="pattern0_2502_300_inner">
            <circle cx="10" cy="10" r="10" fill="#D9C99C" />
          </g>
          <use xlinkHref="#pattern0_2502_300_inner" transform="translate(-15 30)" />
          <use xlinkHref="#pattern0_2502_300_inner" transform="translate(15 30)" />
        </pattern>
      </defs>
    </svg>
  );
}

export default Background;

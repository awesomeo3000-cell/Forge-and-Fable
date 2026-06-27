"use client";

function ClassIconPlaceholder(props: {
  classId: string;
  size: number;
  strokeWidth?: number;
}) {
  const strokeWidth = Math.max(4.25, (props.strokeWidth ?? 1.5) * 2.9);
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth,
  };
  const fill = { fill: "currentColor" };

  return (
    <svg
      aria-hidden="true"
      className="class-symbol"
      focusable="false"
      height={props.size}
      viewBox="0 0 64 64"
      width={props.size}
    >
      {props.classId === "barbarian" ? (
        <>
          <path {...fill} d="M29 25h6v27h-6z" />
          <path {...fill} d="M26 51h12l-6 8z" />
          <path {...fill} d="M31.5 8c-5.6 8.8-13.2 12.6-24 11.7 2.8 9.4 9.8 16.5 20.5 17.8v-9.8c-3.8-1.3-6.8-3.6-9-7.1 5.7-.6 10.1-3.3 12.5-7.6z" />
          <path {...fill} d="M32.5 8c5.6 8.8 13.2 12.6 24 11.7-2.8 9.4-9.8 16.5-20.5 17.8v-9.8c3.8-1.3 6.8-3.6 9-7.1-5.7-.6-10.1-3.3-12.5-7.6z" />
        </>
      ) : null}
      {props.classId === "bard" ? (
        <>
          <circle {...fill} cx="22" cy="46" r="7" />
          <circle {...fill} cx="43" cy="38" r="6" />
          <path {...stroke} d="M28 46V18l22-5v24" />
          <path {...stroke} d="M28 25 50 20" />
          <path {...stroke} d="M14 21c4-4 9-4 13 0" />
        </>
      ) : null}
      {props.classId === "cleric" ? (
        <>
          <circle {...stroke} cx="32" cy="23" r="8" />
          <path {...fill} d="M29 29h6v24h-6z" />
          <path {...fill} d="M26 51h12l-6 8z" />
          <path {...stroke} d="M32 5v8M32 33v8M14 23h8M42 23h8M19.5 10.5l5.6 5.6M38.9 29.9l5.6 5.6M44.5 10.5l-5.6 5.6M25.1 29.9l-5.6 5.6" />
        </>
      ) : null}
      {props.classId === "druid" ? (
        <>
          <path {...fill} d="M33 5c14 11 21 23 18 35-3 11-12 17-19 19-7-2-16-8-19-19C10 28 19 15 33 5Z" />
          <path d="M32 18v30M22 29l10 8 10-8M24 42l8 6 8-6" stroke="#050607" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
        </>
      ) : null}
      {props.classId === "fighter" ? (
        <>
          <path {...fill} d="M14 12h36v20c0 12-7 20-18 27-11-7-18-15-18-27z" />
          <path d="M32 12v42M22 21h20" stroke="#050607" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          <path d="M32 19v29" stroke="#050607" strokeLinecap="round" strokeWidth="7" />
        </>
      ) : null}
      {props.classId === "monk" ? (
        <>
          <path {...fill} d="M18 28c0-4 3-7 7-7h18c4 0 7 3 7 7v11c0 11-7 18-18 18S14 50 14 39v-6c0-3 2-5 4-5z" />
          <rect {...fill} x="17" y="11" width="8" height="21" rx="4" />
          <rect {...fill} x="27" y="8" width="8" height="24" rx="4" />
          <rect {...fill} x="37" y="11" width="8" height="21" rx="4" />
          <path d="M19 44h27M20 52h23" stroke="#050607" strokeLinecap="round" strokeWidth="4" />
        </>
      ) : null}
      {props.classId === "paladin" ? (
        <>
          <path {...fill} d="M32 6 52 15v17c0 12-7 21-20 27-13-6-20-15-20-27V15z" />
          <path d="M32 19v27M23 30h18" stroke="#050607" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
        </>
      ) : null}
      {props.classId === "ranger" ? (
        <>
          <path {...stroke} d="M13 51c17-6 30-19 38-38" />
          <path {...stroke} d="M18 16c14 2 25 13 29 29" />
          <path {...stroke} d="M50 13v14M50 13H36" />
          <path {...fill} d="M48 8 59 5 56 16z" />
          <path {...fill} d="M10 54 5 59l2-12z" />
        </>
      ) : null}
      {props.classId === "rogue" ? (
        <>
          <path {...fill} d="M29 9h6v38h-6z" />
          <path {...fill} d="M20 21h24v8H20z" />
          <path {...fill} d="M32 58 22 45h20z" />
          <circle {...fill} cx="32" cy="9" r="5" />
        </>
      ) : null}
      {props.classId === "sorcerer" ? (
        <>
          <path {...fill} d="M34 5c7 8 8 15 3 22 6-3 11-1 14 5 5 10-2 25-19 25S8 42 14 31c3-5 7-8 13-8-3-7-1-13 7-18z" />
          <path d="M24 39c1 7 5 11 10 11s9-4 9-10c-4 4-8 3-11-2-2 5-5 6-8 1z" fill="#050607" />
        </>
      ) : null}
      {props.classId === "warlock" ? (
        <>
          <path {...stroke} d="M8 32c7-10 15-15 24-15s17 5 24 15c-7 10-15 15-24 15S15 42 8 32z" />
          <circle {...fill} cx="32" cy="32" r="8" />
          <path {...fill} d="M32 5 37 16H27zM13 48l10-5-3 11zM51 48l-10-5 3 11z" />
        </>
      ) : null}
      {props.classId === "wizard" ? (
        <>
          <path {...stroke} d="M11 18c9-5 17-5 25 0 6-4 12-5 17-3v37c-6-2-12-1-17 3-8-5-16-5-25 0z" />
          <path {...stroke} d="M36 18v37" />
          <path {...fill} d="M48 6 51 14l8 3-8 3-3 8-3-8-8-3 8-3z" />
        </>
      ) : null}
      {!props.classId ? (
        <>
          <path {...stroke} d="M32 12 38 26l14 6-14 6-6 14-6-14-14-6 14-6z" />
          <circle {...stroke} cx="32" cy="32" r="22" />
        </>
      ) : null}
    </svg>
  );
}

export default ClassIconPlaceholder;

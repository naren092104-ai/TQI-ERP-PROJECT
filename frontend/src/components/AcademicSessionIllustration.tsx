import React from 'react';

export const ACADEMIC_SESSION_NAMES = [
  'Parents Meet',
  'Know Your Locality',
  'Books to Bytes',
  'Sports',
  'Science',
  'Art Education',
  'Constitution',
  'Tinkering Session',
] as const;

const sceneBackgrounds = [
  '#FCE6CE', '#DDF4F2', '#E4EDFF', '#E2F4D5',
  '#FFF2C9', '#FCE4EF', '#FDEBD4', '#DFEAFE',
];

interface AcademicSessionIllustrationProps {
  dayNumber: number;
}

export const AcademicSessionIllustration: React.FC<AcademicSessionIllustrationProps> = ({ dayNumber }) => {
  const background = sceneBackgrounds[dayNumber - 1] || '#E8EEFF';
  const scene = (() => {
    switch (dayNumber) {
      case 1:
        return <>
          <rect x="48" y="32" width="304" height="122" rx="12" fill="#FFF9EF" />
          <rect x="65" y="48" width="270" height="12" rx="6" fill="#E9DDBF" />
          <rect x="106" y="116" width="188" height="18" rx="8" fill="#B9784D" />
          <path d="M124 132v34m164-34v34" stroke="#875237" strokeWidth="8" strokeLinecap="round" />
          <circle cx="112" cy="89" r="19" fill="#D78F68" /><circle cx="200" cy="85" r="20" fill="#F2BE83" /><circle cx="288" cy="89" r="19" fill="#7D523F" />
          <path d="M82 114c5-20 55-20 60 0m28-6c6-24 54-24 60 0m28 6c5-20 55-20 60 0" fill="#4C8C7D" />
          <path d="M90 78q22-27 44 0m44-4q22-27 44 0m44 4q22-27 44 0" fill="#263F50" />
          <circle cx="118" cy="89" r="2.5" fill="#263F50" /><circle cx="106" cy="89" r="2.5" fill="#263F50" />
          <circle cx="206" cy="85" r="2.5" fill="#263F50" /><circle cx="194" cy="85" r="2.5" fill="#263F50" />
          <circle cx="294" cy="89" r="2.5" fill="#263F50" /><circle cx="282" cy="89" r="2.5" fill="#263F50" />
          <path d="M0 178q105-36 200 0t200 0v62H0z" fill="#F5C693" />
        </>;
      case 2:
        return <>
          <circle cx="317" cy="50" r="25" fill="#FFD66B" />
          <path d="M0 164q93-68 186 0t214-2v78H0z" fill="#9BCF9A" />
          <path d="M188 238q17-53 49-87t80-44" fill="none" stroke="#E8C48C" strokeWidth="25" />
          <path d="m48 139 45-43 47 43v49H48z" fill="#F0A66D" /><path d="m43 139 50-50 51 50" fill="#B95648" stroke="#93453C" strokeWidth="8" />
          <rect x="66" y="151" width="20" height="37" fill="#F7E7BB" /><rect x="109" y="150" width="18" height="18" fill="#A8D9E8" />
          <path d="m244 124 42-40 45 40v43h-87z" fill="#F6D597" /><path d="m238 124 48-47 51 47" fill="#739EB4" stroke="#557B8E" strokeWidth="8" />
          <rect x="268" y="143" width="20" height="24" fill="#A8D9E8" />
          <path d="M193 125v55m-16-39h32" stroke="#447E57" strokeWidth="8" strokeLinecap="round" />
          <circle cx="193" cy="111" r="25" fill="#65A96D" /><circle cx="175" cy="119" r="17" fill="#78B977" /><circle cx="211" cy="119" r="17" fill="#78B977" />
          <path d="M0 206q100-10 200 0t200 0v34H0z" fill="#75B779" />
          <path d="M171 192c13-19 27-19 40 0" fill="none" stroke="#F8FAE8" strokeWidth="7" strokeLinecap="round" />
        </>;
      case 3:
        return <>
          <rect x="48" y="37" width="304" height="145" rx="12" fill="#F7FAFF" />
          <rect x="235" y="62" width="84" height="64" rx="7" fill="#325D83" /><rect x="243" y="70" width="68" height="47" rx="4" fill="#90D6E7" />
          <path d="M274 126v13m-26 0h52" stroke="#637F9A" strokeWidth="8" strokeLinecap="round" />
          <path d="M76 133h104v37H76z" fill="#BE704B" /><path d="M89 120h87v13H89z" fill="#E5B84F" />
          <path d="M85 108h91v12H85z" fill="#5D9B8E" /><path d="M91 96h83v12H91z" fill="#DB745A" />
          <path d="M195 95q31-30 62 0v42h-62z" fill="#E5B649" /><path d="M195 95q31 29 62 0" fill="none" stroke="#B9892E" strokeWidth="4" />
          <path d="M0 185h400v55H0z" fill="#C99769" /><path d="M0 196h400" stroke="#A6754E" strokeWidth="5" />
          <circle cx="124" cy="70" r="18" fill="#C9805E" /><path d="M104 95q20-16 40 0v20h-40z" fill="#527F9B" />
          <circle cx="202" cy="70" r="18" fill="#EAB77B" /><path d="M182 95q20-16 40 0v20h-40z" fill="#D76B55" />
          <path d="M114 58q10-17 21-1" fill="none" stroke="#3B3030" strokeWidth="9" strokeLinecap="round" />
          <path d="M192 57q10-17 21-1" fill="none" stroke="#3B3030" strokeWidth="9" strokeLinecap="round" />
        </>;
      case 4:
        return <>
          <circle cx="324" cy="48" r="24" fill="#FFD86A" />
          <path d="M0 150q99-43 197 0t203 0v90H0z" fill="#94CB77" />
          <path d="M0 192q105-33 202 0t198 0v48H0z" fill="#6CAE61" />
          <circle cx="200" cy="156" r="39" fill="#FFFDF4" stroke="#2F5361" strokeWidth="6" />
          <path d="m200 132 16 12-6 20h-20l-6-20z" fill="#2F5361" /><path d="m164 151 16-7m42 0 16 7m-52 32 14-13m24 0 14 13" stroke="#2F5361" strokeWidth="6" />
          <circle cx="92" cy="126" r="17" fill="#D88E67" /><path d="m92 145 20 34m-19-17-22 10m40-1 16-17m-36 25-19 22m34-18 21 18" stroke="#466D90" strokeWidth="11" strokeLinecap="round" />
          <circle cx="300" cy="120" r="17" fill="#9D6549" /><path d="m300 139-18 36m17-18 22 8m-40-1-15-20m31 31 20 19m-35-15-20 16" stroke="#D16A53" strokeWidth="11" strokeLinecap="round" />
          <path d="M57 180h32m-48 14h28m282-55h23m-14 17h26" stroke="#F6FFE9" strokeWidth="5" strokeLinecap="round" />
        </>;
      case 5:
        return <>
          <circle cx="325" cy="48" r="23" fill="#FFD55E" />
          <path d="M0 183q95-32 200 0t200 0v57H0z" fill="#AFD88C" />
          <path d="M77 70h37v17l31 69q7 17-13 17H58q-18 0-11-17l30-69z" fill="#F8FCFF" stroke="#527F9A" strokeWidth="7" strokeLinejoin="round" />
          <path d="M67 151h67l9 19q4 8-12 8H59q-12 0-7-11z" fill="#62B5C7" />
          <circle cx="85" cy="151" r="6" fill="#F4D15D" /><circle cx="106" cy="162" r="5" fill="#F4D15D" /><circle cx="122" cy="148" r="4" fill="#F4D15D" />
          <path d="M244 74h37m-29 0v45l-31 54q-8 16 11 16h61q20 0 11-17l-29-53V74" fill="#FFFDF2" stroke="#6E7F9C" strokeWidth="7" strokeLinejoin="round" />
          <path d="M232 157h67l13 24q4 8-11 8h-78q-13 0-9-10z" fill="#E68168" />
          <circle cx="254" cy="153" r="5" fill="#F9D96E" /><circle cx="280" cy="165" r="6" fill="#F9D96E" />
          <circle cx="189" cy="77" r="18" fill="#D9906B" /><path d="M168 105q21-18 42 0v39h-42z" fill="#5389A1" />
          <path d="M179 47q12-18 25 0" fill="none" stroke="#4B3936" strokeWidth="9" strokeLinecap="round" />
          <path d="M18 54h20m-10-10v20m344 59h18m-9-9v18" stroke="#EEB950" strokeWidth="5" strokeLinecap="round" />
        </>;
      case 6:
        return <>
          <circle cx="322" cy="48" r="22" fill="#FFD15B" />
          <path d="M0 176q100-38 200 0t200 0v64H0z" fill="#A3D18D" />
          <path d="M91 48h160v117H91z" rx="8" fill="#E8A56C" />
          <rect x="105" y="59" width="132" height="88" rx="4" fill="#FFF8E8" />
          <path d="M119 124q31-43 53-7t46-37v67H119z" fill="#8FC2B4" />
          <circle cx="151" cy="85" r="14" fill="#F2C951" /><path d="M105 165h132l15 20H88z" fill="#A96B4D" />
          <path d="M251 122c4-26 30-37 50-24 13 9 7 30-11 43-15 11-35 6-39-19z" fill="#F2C951" />
          <circle cx="267" cy="109" r="5" fill="#E66A5C" /><circle cx="286" cy="111" r="5" fill="#477EAA" /><circle cx="277" cy="127" r="5" fill="#72A976" />
          <path d="m272 82 38-31 8 8-30 42" fill="#C9664E" stroke="#994A40" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="57" cy="133" r="17" fill="#C9805B" /><path d="M37 151q20-18 40 0v39H37z" fill="#5C8EAC" />
          <circle cx="338" cy="138" r="16" fill="#E5B17B" /><path d="M320 155q18-17 37 0v34h-37z" fill="#D17A58" />
        </>;
      case 7:
        return <>
          <rect x="48" y="34" width="304" height="140" rx="14" fill="#FFF9EC" />
          <path d="M89 78q55-23 111 2v67q-56-25-111-2z" fill="#F7E2B6" stroke="#AA7549" strokeWidth="6" />
          <path d="M200 80q55-25 111-2v67q-56-23-111 2z" fill="#FFEDC9" stroke="#AA7549" strokeWidth="6" />
          <path d="M200 80v67" stroke="#AA7549" strokeWidth="5" />
          <path d="M106 96h71m-71 14h76m-76 14h61m48-28h73m-73 14h76m-76 14h62" stroke="#C5A475" strokeWidth="4" strokeLinecap="round" />
          <path d="M156 66v-15m44 15V45m44 21V51" stroke="#627A98" strokeWidth="6" strokeLinecap="round" />
          <circle cx="200" cy="48" r="13" fill="#E4A158" />
          <path d="M0 191q108-23 200 0t200 0v49H0z" fill="#D4A974" />
          <path d="M75 185h250" stroke="#A67751" strokeWidth="8" strokeLinecap="round" />
          <circle cx="93" cy="178" r="11" fill="#6A9BAA" /><circle cx="307" cy="178" r="11" fill="#6A9BAA" />
        </>;
      default:
        return <>
          <circle cx="325" cy="48" r="23" fill="#FFD264" />
          <path d="M0 181q100-38 200 0t200 0v59H0z" fill="#A6D18D" />
          <rect x="108" y="75" width="182" height="111" rx="18" fill="#E7A25F" stroke="#A56D48" strokeWidth="7" />
          <rect x="132" y="97" width="134" height="65" rx="12" fill="#D9F2ED" />
          <circle cx="166" cy="124" r="9" fill="#4B8292" /><circle cx="232" cy="124" r="9" fill="#4B8292" />
          <path d="M171 144q28 23 56 0" fill="none" stroke="#4B8292" strokeWidth="6" strokeLinecap="round" />
          <path d="M165 75V52m69 23V52" stroke="#A56D48" strokeWidth="8" strokeLinecap="round" />
          <circle cx="165" cy="47" r="13" fill="#E56F58" /><circle cx="234" cy="47" r="13" fill="#6B91C0" />
          <path d="M86 89 62 109l28 12m220 31 27 15-26 16" fill="none" stroke="#6682A0" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="81" cy="61" r="17" fill="#E7C54F" /><path d="M81 34v-13m0 80v-13M54 61H41m80 0h-13m-46-19L52 32m58 58-9-9m0-40 9-9m-58 58-9 9" stroke="#D8A93E" strokeWidth="5" strokeLinecap="round" />
          <path d="M130 186v28m136-28v28" stroke="#795E4D" strokeWidth="9" strokeLinecap="round" />
        </>;
    }
  })();

  return (
    <svg
      viewBox="0 0 400 240"
      role="img"
      aria-label={`${ACADEMIC_SESSION_NAMES[dayNumber - 1] || 'Academic session'} illustration`}
      className="h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="400" height="240" fill={background} />
      <path d="M0 18Q95 54 196 18T400 24V0H0z" fill="#FFFFFF" opacity=".35" />
      {scene}
    </svg>
  );
};

import type {SVGProps} from 'react';

const SvgLineIcon = (props: SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}>
        <path
            fill="currentColor"
            d="M12 3C6.5 3 2 6.58 2 11c0 3.93 3.56 7.23 8.37 7.88.33.07.78.22.9.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.02.87.56 1.07-.45 5.78-3.4 7.88-5.83C21.36 14.41 22 12.77 22 11c0-4.42-4.5-8-10-8Z"
        />
        <path
            fill="#06C755"
            d="M7.28 13.92h2.55v-.9H8.25V8.34h-.97v5.58Zm3.1 0h.98V8.34h-.98v5.58Zm1.7 0h.96v-3.35l2.14 3.35h.94V8.34h-.96v3.35l-2.14-3.35h-.94v5.58Zm4.68 0h3.02v-.9h-2.05v-1.43h1.84v-.89h-1.84V9.24h2.05v-.9h-3.02v5.58Z"
        />
    </svg>
);

export default SvgLineIcon;

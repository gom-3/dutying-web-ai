/** Preserve server wording while making each sentence or supplied bullet readable. */
export function failureMessagePoints(message: string): string[] {
    return message
        .split(/(?:\r?\n)+|(?<=[.!?])\s+|(?<=[。！？])/u)
        .map((line) => line.replace(/^\s*[-•]\s*/, '').trim())
        .filter(Boolean);
}

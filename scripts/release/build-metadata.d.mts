export function createBuildMetadata(
    env: Record<string, string | undefined>,
    version: string,
    siteUrl: string,
): {
    version: string;
    commit: string | null;
    branch: string | null;
    provider: string;
    environment: string;
    siteUrl: string;
    deploymentUrl: string | null;
};

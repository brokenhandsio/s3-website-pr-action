import * as github from '@actions/github'

type GithubClient = ReturnType<typeof github.getOctokit>

let githubClient: GithubClient | null = null

export function getGithubClient(): GithubClient {
	if (!githubClient) {
		const { GITHUB_TOKEN } = process.env
		if (!GITHUB_TOKEN) {
			throw new Error('GITHUB_TOKEN environment variable is required')
		}
		githubClient = github.getOctokit(GITHUB_TOKEN, { previews: ['ant-man-preview', 'flash-preview'] })
	}
	return githubClient
}

// For testing - allows injecting a mock client
export function setGithubClient(client: GithubClient | any): void {
	githubClient = client
}

// For testing - resets to allow fresh initialization
export function resetGithubClient(): void {
	githubClient = null
}

// Default export for backwards compatibility during migration
export default new Proxy({} as GithubClient, {
	get(_, prop) {
		return (getGithubClient() as any)[prop]
	}
})

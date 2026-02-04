import { setGithubClient, resetGithubClient } from '../../githubClient'
import deleteDeployments from '../deleteDeployments'
import { createMockGithubClient } from '../../tests/testUtils'
import * as github from '@actions/github'

// Override context for these tests
beforeAll(() => {
	(github.context as any).eventName = 'pull_request';
	(github.context as any).payload = {
		pull_request: { number: 42 }
	}
})

describe('deleteDeployments', () => {
	let mockGithubClient: ReturnType<typeof createMockGithubClient>
	const repo = { owner: 'test-owner', repo: 'test-repo' }

	beforeEach(() => {
		mockGithubClient = createMockGithubClient()
		setGithubClient(mockGithubClient)
	})

	afterEach(() => {
		resetGithubClient()
		jest.clearAllMocks()
	})

	test('should delete existing deployments', async () => {
		mockGithubClient.rest.repos.listDeployments.mockResolvedValueOnce({
			data: [
				{ id: 1 },
				{ id: 2 }
			]
		})
		mockGithubClient.rest.repos.deleteDeployment.mockResolvedValue({})

		await deleteDeployments(repo, 'PR-')

		expect(mockGithubClient.rest.repos.listDeployments).toHaveBeenCalledWith({
			...repo,
			environment: 'PR-42',
			per_page: 100
		})
		expect(mockGithubClient.rest.repos.deleteDeployment).toHaveBeenCalledTimes(2)
		expect(mockGithubClient.rest.repos.deleteDeployment).toHaveBeenCalledWith({
			...repo,
			deployment_id: 1
		})
		expect(mockGithubClient.rest.repos.deleteDeployment).toHaveBeenCalledWith({
			...repo,
			deployment_id: 2
		})
	})

	test('should handle no existing deployments', async () => {
		mockGithubClient.rest.repos.listDeployments.mockResolvedValueOnce({
			data: []
		})

		await deleteDeployments(repo, 'PR-')

		expect(mockGithubClient.rest.repos.listDeployments).toHaveBeenCalled()
		expect(mockGithubClient.rest.repos.deleteDeployment).not.toHaveBeenCalled()
	})

	test('should use default environment prefix when not provided', async () => {
		mockGithubClient.rest.repos.listDeployments.mockResolvedValueOnce({
			data: []
		})

		await deleteDeployments(repo, '')

		expect(mockGithubClient.rest.repos.listDeployments).toHaveBeenCalledWith({
			...repo,
			environment: 'PR-42',
			per_page: 100
		})
	})
})

import { setGithubClient, resetGithubClient } from '../../githubClient'
import deactivateDeployments from '../deactivateDeployments'
import { createMockGithubClient } from '../../tests/testUtils'
import * as github from '@actions/github'

// Override context for these tests
beforeAll(() => {
	(github.context as any).eventName = 'pull_request';
	(github.context as any).payload = {
		pull_request: { number: 42 }
	}
})

describe('deactivateDeployments', () => {
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

	test('should deactivate existing deployments', async () => {
		mockGithubClient.rest.repos.listDeployments.mockResolvedValueOnce({
			data: [
				{ id: 1 },
				{ id: 2 }
			]
		})
		mockGithubClient.rest.repos.createDeploymentStatus.mockResolvedValue({})

		await deactivateDeployments(repo, 'PR-')

		expect(mockGithubClient.rest.repos.listDeployments).toHaveBeenCalledWith({
			repo: 'test-repo',
			owner: 'test-owner',
			environment: 'PR-42'
		})
		expect(mockGithubClient.rest.repos.createDeploymentStatus).toHaveBeenCalledTimes(2)
		expect(mockGithubClient.rest.repos.createDeploymentStatus).toHaveBeenCalledWith({
			...repo,
			deployment_id: 1,
			state: 'inactive'
		})
		expect(mockGithubClient.rest.repos.createDeploymentStatus).toHaveBeenCalledWith({
			...repo,
			deployment_id: 2,
			state: 'inactive'
		})
	})

	test('should handle no existing deployments', async () => {
		mockGithubClient.rest.repos.listDeployments.mockResolvedValueOnce({
			data: []
		})

		await deactivateDeployments(repo, 'PR-')

		expect(mockGithubClient.rest.repos.listDeployments).toHaveBeenCalled()
		expect(mockGithubClient.rest.repos.createDeploymentStatus).not.toHaveBeenCalled()
	})

	test('should use default environment prefix when not provided', async () => {
		mockGithubClient.rest.repos.listDeployments.mockResolvedValueOnce({
			data: []
		})

		await deactivateDeployments(repo, '')

		expect(mockGithubClient.rest.repos.listDeployments).toHaveBeenCalledWith({
			repo: 'test-repo',
			owner: 'test-owner',
			environment: 'PR-42'
		})
	})
})

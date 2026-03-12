import * as github from '@actions/github'
import prClosedAction from '../prClosedAction'
import { resetGithubClient, setGithubClient } from '../../githubClient'
import { resetS3Client, setS3Client } from '../../s3Client'
import { createMockGithubClient, createMockS3Client } from '../../tests/testUtils'
import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type {
	DeleteObjectsCommandInput,
	ListObjectsCommandInput,
	DeleteBucketCommandInput
} from '@aws-sdk/client-s3'

// Override context for these tests
beforeAll(() => {
	;(github.context as any).eventName = 'pull_request'
	;(github.context as any).payload = {
		pull_request: { number: 42 },
		repository: { owner: { login: 'test-owner' }, name: 'test-repo' }
	}
})

// Set up env vars
process.env.AWS_ACCESS_KEY_ID = 'test-key'
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'

describe('prClosedAction', () => {
	let mockS3Client: ReturnType<typeof createMockS3Client>
	let mockGithubClient: ReturnType<typeof createMockGithubClient>

	beforeEach(() => {
		mockS3Client = createMockS3Client()
		mockGithubClient = createMockGithubClient()
		setS3Client(mockS3Client)
		setGithubClient(mockGithubClient)

		// Default mock responses
		mockGithubClient.rest.repos.listDeployments.mockResolvedValue({
			data: []
		})
	})

	afterEach(() => {
		resetS3Client()
		resetGithubClient()
		jest.clearAllMocks()
	})

	test('should delete objects from bucket when objects exist', async () => {
		mockS3Client.send.mockResolvedValueOnce({
			Contents: [{ Key: 'file1.html' }, { Key: 'file2.css' }]
		})
		mockS3Client.send.mockResolvedValue({})

		await prClosedAction('test-bucket', 'PR-')

		// First call: ListObjectsV2Command
		expect(mockS3Client.send).toHaveBeenCalledTimes(3)

		// Second call: DeleteObjectsCommand
		const deleteCall = mockS3Client.send.mock.calls[1][0]
		expect((deleteCall.input as ListObjectsCommandInput).Bucket).toBe('test-bucket')
		expect((deleteCall.input as DeleteObjectsCommandInput).Delete?.Objects).toEqual([
			{ Key: 'file1.html' },
			{ Key: 'file2.css' }
		])
	})

	test('should skip object deletion when bucket is empty', async () => {
		mockS3Client.send.mockResolvedValueOnce({
			Contents: []
		})
		mockS3Client.send.mockResolvedValue({})

		await prClosedAction('test-bucket', 'PR-')

		// First call: ListObjectsV2Command, Second call: DeleteBucketCommand
		expect(mockS3Client.send).toHaveBeenCalledTimes(2)
	})

	test('should delete the bucket', async () => {
		mockS3Client.send.mockResolvedValueOnce({ Contents: [] })
		mockS3Client.send.mockResolvedValue({})

		await prClosedAction('test-bucket', 'PR-')

		const deleteBucketCall = mockS3Client.send.mock.calls[1][0]
		expect((deleteBucketCall.input as DeleteBucketCommandInput).Bucket).toBe('test-bucket')
	})

	test('should deactivate and delete deployments', async () => {
		mockS3Client.send.mockResolvedValueOnce({ Contents: [] })
		mockS3Client.send.mockResolvedValue({})
		mockGithubClient.rest.repos.listDeployments.mockResolvedValue({
			data: [{ id: 123 }] as any
		})
		mockGithubClient.rest.repos.createDeploymentStatus.mockResolvedValue({ data: [] as any })
		mockGithubClient.rest.repos.deleteDeployment.mockResolvedValue({ data: [] as any })

		await prClosedAction('test-bucket', 'PR-')

		expect(mockGithubClient.rest.repos.listDeployments).toHaveBeenCalled()
		expect(mockGithubClient.rest.repos.createDeploymentStatus).toHaveBeenCalledWith(
			expect.objectContaining({
				deployment_id: 123,
				state: 'inactive'
			})
		)
		expect(mockGithubClient.rest.repos.deleteDeployment).toHaveBeenCalledWith(
			expect.objectContaining({
				deployment_id: 123
			})
		)
	})
})

import * as github from '@actions/github'
import prClosedAction from '../prClosedAction'
import { resetGithubClient, setGithubClient } from '../../githubClient'
import { resetS3Client, setS3Client } from '../../s3Client'
import { createMockGithubClient, createMockS3Client } from '../../tests/testUtils'
import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type {
	DeleteObjectsCommandInput,
	ListObjectsCommandInput,
	ListObjectsV2CommandInput,
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

	test('should page through and delete objects when the listing is truncated', async () => {
		// send() is called in a fixed order: list page 1, delete page 1,
		// list page 2, delete page 2, delete bucket.
		mockS3Client.send
			.mockResolvedValueOnce({
				Contents: [{ Key: 'file1.html' }, { Key: 'file2.css' }],
				IsTruncated: true,
				NextContinuationToken: 'token-1'
			})
			.mockResolvedValueOnce({}) // delete page 1
			.mockResolvedValueOnce({
				Contents: [{ Key: 'file3.js' }],
				IsTruncated: false
			})
		mockS3Client.send.mockResolvedValue({}) // delete page 2, delete bucket

		await prClosedAction('test-bucket', 'PR-')

		// List page 1, Delete page 1, List page 2, Delete page 2, DeleteBucket
		expect(mockS3Client.send).toHaveBeenCalledTimes(5)

		// The second list call must forward the continuation token
		const secondListCall = mockS3Client.send.mock.calls[2][0]
		expect((secondListCall.input as ListObjectsV2CommandInput).ContinuationToken).toBe('token-1')

		// Both batches get deleted
		const firstDeleteCall = mockS3Client.send.mock.calls[1][0]
		expect((firstDeleteCall.input as DeleteObjectsCommandInput).Delete?.Objects).toEqual([
			{ Key: 'file1.html' },
			{ Key: 'file2.css' }
		])
		const secondDeleteCall = mockS3Client.send.mock.calls[3][0]
		expect((secondDeleteCall.input as DeleteObjectsCommandInput).Delete?.Objects).toEqual([
			{ Key: 'file3.js' }
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
		mockGithubClient.rest.repos.deleteDeployment.mockResolvedValue({ data: undefined } as any)

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

import { jest, afterEach, beforeEach, describe, test, expect } from '@jest/globals'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'
import { setS3Client, resetS3Client } from '../../s3Client'
import s3UploadDirectory, { DEFAULT_UPLOAD_CONCURRENCY } from '../s3UploadDirectory'
import { createMockS3Client } from '../../tests/testUtils'

describe('s3UploadDirectory', () => {
	let mockS3Client: ReturnType<typeof createMockS3Client>
	let directory: string

	// Holds each upload open briefly and records how many were in flight at once.
	let inFlight: number
	let maxInFlight: number
	const trackConcurrency = (fail?: (key: string) => boolean) =>
		mockS3Client.send.mockImplementation((async (command: any) => {
			inFlight += 1
			maxInFlight = Math.max(maxInFlight, inFlight)
			await new Promise(resolve => setTimeout(resolve, 2))
			inFlight -= 1
			if (fail?.(command.input.Key)) {
				throw Object.assign(new Error('Access Denied'), { name: 'AccessDenied' })
			}
			return {}
		}) as any)

	const writeFiles = (count: number) => {
		for (let i = 0; i < count; i++) {
			writeFileSync(path.join(directory, `page-${i}.html`), `<p>${i}</p>`)
		}
	}

	beforeEach(() => {
		mockS3Client = createMockS3Client()
		setS3Client(mockS3Client)
		directory = mkdtempSync(path.join(os.tmpdir(), 's3-upload-'))
		inFlight = 0
		maxInFlight = 0
		jest.spyOn(console, 'log').mockImplementation(() => {})
	})

	afterEach(() => {
		rmSync(directory, { recursive: true, force: true })
		resetS3Client()
		jest.restoreAllMocks()
	})

	test('uploads every file with its key, content type, ACL and encryption', async () => {
		mkdirSync(path.join(directory, 'docs'))
		writeFileSync(path.join(directory, 'index.html'), '<h1>Home</h1>')
		writeFileSync(path.join(directory, 'docs', 'style.css'), 'body {}')
		mockS3Client.send.mockResolvedValue({})

		await s3UploadDirectory('test-bucket', directory)

		const inputs = mockS3Client.send.mock.calls
			.map(([command]: any[]) => command.input)
			.sort((a: any, b: any) => a.Key.localeCompare(b.Key))
		expect(inputs).toEqual([
			expect.objectContaining({
				Bucket: 'test-bucket',
				Key: 'docs/style.css',
				ContentType: 'text/css',
				ACL: 'public-read',
				ServerSideEncryption: 'AES256'
			}),
			expect.objectContaining({ Key: 'index.html', ContentType: 'text/html' })
		])
		expect(inputs[1].Body.toString()).toBe('<h1>Home</h1>')
	})

	test('never has more uploads in flight than the concurrency limit', async () => {
		writeFiles(40)
		trackConcurrency()

		await s3UploadDirectory('test-bucket', directory, 4)

		expect(mockS3Client.send).toHaveBeenCalledTimes(40)
		expect(maxInFlight).toBe(4)
	})

	test('defaults to a bounded concurrency', async () => {
		writeFiles(DEFAULT_UPLOAD_CONCURRENCY * 3)
		trackConcurrency()

		await s3UploadDirectory('test-bucket', directory)

		expect(mockS3Client.send).toHaveBeenCalledTimes(DEFAULT_UPLOAD_CONCURRENCY * 3)
		expect(maxInFlight).toBe(DEFAULT_UPLOAD_CONCURRENCY)
	})

	test('stops starting uploads after a failure and rejects with the failing key', async () => {
		writeFiles(40)
		trackConcurrency(key => key === 'page-0.html')

		await expect(s3UploadDirectory('test-bucket', directory, 4)).rejects.toThrow(
			'Failed to upload page-0.html: AccessDenied - Access Denied'
		)
		// Only the uploads already in flight when it failed get to finish.
		expect(mockS3Client.send.mock.calls.length).toBeLessThan(40)
	})

	test('does nothing for an empty directory', async () => {
		await s3UploadDirectory('test-bucket', directory)

		expect(mockS3Client.send).not.toHaveBeenCalled()
	})
})

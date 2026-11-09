import { getS3Client } from '../s3Client'
import readdir from 'recursive-readdir'
import { promises as fs } from 'fs'
import path from 'path'
import filePathToS3Key from './filePathToS3Key'
import mimeTypes from 'mime-types'
import { PutObjectCommand } from '@aws-sdk/client-s3'

// How many files are read and uploaded at once. Uploading every file in parallel
// buffers the whole site in memory and opens a request per file, which kills the
// runner on large sites (thousands of files, gigabytes in total).
export const DEFAULT_UPLOAD_CONCURRENCY = 16

export default async (
	bucketName: string,
	directory: string,
	concurrency: number = DEFAULT_UPLOAD_CONCURRENCY
) => {
	const normalizedPath = path.normalize(directory)

	const files = await readdir(normalizedPath)
	const workerCount = Math.max(1, Math.min(Math.floor(concurrency) || 1, files.length))

	console.log(`Uploading ${files.length} files to ${bucketName} (${workerCount} at a time)...`)

	let nextIndex = 0
	let uploaded = 0
	let firstError: Error | undefined

	const uploadFile = async (filePath: string) => {
		const s3Key = filePathToS3Key(filePath.replace(normalizedPath, ''))

		try {
			// Read inside the worker so only `workerCount` files are in memory at once.
			const fileBuffer = await fs.readFile(filePath)
			const mimeType = mimeTypes.lookup(filePath) || 'application/octet-stream'

			const command = new PutObjectCommand({
				Bucket: bucketName,
				Key: s3Key,
				Body: fileBuffer,
				ACL: 'public-read',
				ServerSideEncryption: 'AES256',
				ContentType: mimeType
			})
			await getS3Client().send(command)

			uploaded += 1
			console.log(`Uploaded ${s3Key} (${uploaded}/${files.length})`)
		} catch (e: any) {
			console.log(e)
			throw new Error(`Failed to upload ${s3Key}: ${e?.name ?? e?.code} - ${e?.message ?? e}`)
		}
	}

	// A fixed pool of workers pulls from a shared queue. After the first failure no
	// new uploads start; uploads already in flight finish, then the error is thrown.
	const worker = async () => {
		while (!firstError && nextIndex < files.length) {
			const filePath = files[nextIndex++]
			try {
				await uploadFile(filePath)
			} catch (e: any) {
				firstError ??= e
			}
		}
	}

	await Promise.all(Array.from({ length: workerCount }, worker))

	if (firstError) {
		console.log(firstError.message)
		throw firstError
	}

	console.log(`Uploaded ${uploaded} files to ${bucketName}`)
}

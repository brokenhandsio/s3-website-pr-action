import { getS3Client } from '../s3Client'
import readdir from 'recursive-readdir'
import { promises as fs } from 'fs'
import path from 'path'
import filePathToS3Key from './filePathToS3Key'
import mimeTypes from 'mime-types'
import { PutObjectCommand } from '@aws-sdk/client-s3';

export default async (bucketName: string, directory: string) => {
	const normalizedPath = path.normalize(directory)

	const files = await readdir(normalizedPath)

	await Promise.all(
		files.map(async filePath => {
			const s3Key = filePathToS3Key(filePath.replace(normalizedPath, ''))

			console.log(`Uploading ${s3Key} to ${bucketName}`)

			try {
				const fileBuffer = await fs.readFile(filePath)
				const mimeType = mimeTypes.lookup(filePath) || 'application/octet-stream'
				const acl = 'public-read' as const;
				const sse = 'AES256' as const;

				const input = {
					Bucket: bucketName,
					Key: s3Key,
					Body: fileBuffer,
					ACL: acl,
					ServerSideEncryption: sse,
					ContentType: mimeType
				}

				const command = new PutObjectCommand(input)
				const response = await getS3Client().send(command)

				console.log({ response })
			} catch (e) {
				console.log(e)
				const message = `Failed to upload ${s3Key}: ${e.code} - ${e.message}`
				console.log(message)
				throw message
			}
		})
	)
}

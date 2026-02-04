import { getS3Client } from '../s3Client'
import { HeadBucketCommand } from '@aws-sdk/client-s3'

export default async (bucketName: string) => {
	try {
		const input = {
			Bucket: bucketName,
		}
		const command = new HeadBucketCommand(input)
		await getS3Client().send(command)
		return true
	} catch (e) {
		console.log(e)
		return false
	}
}

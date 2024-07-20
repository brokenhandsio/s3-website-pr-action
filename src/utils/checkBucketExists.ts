import S3 from '../s3Client'
import { HeadBucketCommand } from '@aws-sdk/client-s3'

export default async (bucketName: string) => {
	try {
		const input = {
			Bucket: bucketName, 
		}
		const command = new HeadBucketCommand(input)
		await S3.send(command)
		return true
	} catch (e) {
		console.log(e)
		return false
	}
}

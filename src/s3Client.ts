import { S3Client } from '@aws-sdk/client-s3'
import * as core from '@actions/core'


export default new S3Client(
    { 
        region: core.getInput('bucket-region')
    }
)

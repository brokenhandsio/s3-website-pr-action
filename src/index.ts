import * as core from '@actions/core'
import * as github from '@actions/github'
import prClosedAction from './actions/prClosedAction'
import prUpdatedAction from './actions/prUpdatedAction'
import uploadAction from './actions/uploadAction'
import dayjs from 'dayjs'

const main = async () => {
	try {
		const bucketPrefix = core.getInput('bucket-prefix', { required: true })
		const bucketRegion = core.getInput('bucket-region', { required: true })
		const folderToCopy = core.getInput('folder-to-copy')
		const environmentPrefix = core.getInput('environment-prefix')
		const indexDocument = core.getInput('index-document') || 'index.html'
		const errorDocument = core.getInput('error-document') || 'error.html'
		const tokenFromInput = core.getInput('token')

		if (tokenFromInput) {
			// If a nonempty token was provided as an input, it overrides the env var
			process.env.GITHUB_TOKEN = tokenFromInput
		}

		const githubEventName = github.context.eventName
		if (githubEventName === 'pull_request') {
			const prNumber = github.context.payload.pull_request!.number
			const bucketName = `${bucketPrefix}-pr-${prNumber}`

			console.log(`Bucket Name: ${bucketName} in region: ${bucketRegion}`)

			const githubActionType = github.context.payload.action
			switch (githubActionType) {
				case 'opened':
				case 'reopened':
				case 'synchronize':
					await prUpdatedAction(
						bucketName,
						bucketRegion,
						folderToCopy,
						environmentPrefix,
						indexDocument,
						errorDocument
					)
					break

				case 'closed':
					await prClosedAction(bucketName, environmentPrefix)
					break

				default:
					console.log('PR not created, modified or deleted. Skiping...')
					break
			}
		} else {
			const bucketName = `${bucketPrefix}-${dayjs().format('DD-MM-YYYY-hh-mma')}`

			await uploadAction(
				bucketName,
				bucketRegion,
				folderToCopy,
				environmentPrefix,
				indexDocument,
				errorDocument
			)
		}
	} catch (error: any) {
		console.log(error)
		core.setFailed(error)
	}
}

main()

import * as core from '@actions/core'
import * as github from '@actions/github'
import prClosedAction from './actions/prClosedAction'
import prUpdatedAction from './actions/prUpdatedAction'
import uploadAction from './actions/uploadAction'

const main = async () => {
	try {
		const bucketPrefix = core.getInput('bucket-prefix')
		const folderToCopy = core.getInput('folder-to-copy')
		const environmentPrefix = core.getInput('environment-prefix')

		const githubEventName = github.context.eventName
		if (githubEventName === 'pull_request') {
			const prNumber = github.context.payload.pull_request!.number
			const bucketName = `${bucketPrefix}-pr-${prNumber}`

			console.log(`Bucket Name: ${bucketName}`)

			const githubActionType = github.context.payload.action
			switch (githubActionType) {
				case 'opened':
				case 'reopened':
				case 'synchronize':
					await prUpdatedAction(bucketName, folderToCopy, environmentPrefix)
					break

				case 'closed':
					await prClosedAction(bucketName, environmentPrefix)
					break

				default:
					console.log('PR not created, modified or deleted. Skiping...')
					break
			}
		} else {
			const lastCommitSha = github.context.sha

			const bucketName = `${bucketPrefix}-${githubEventName}-${lastCommitSha.slice(0, 7)}`

			await uploadAction(bucketName, folderToCopy, environmentPrefix)
		}
	} catch (error) {
		console.log(error)
		core.setFailed(error)
	}
}

main()

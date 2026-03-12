module.exports = {
	arrowParens: 'avoid',
	trailingComma: 'none',
	tabWidth: 4,
	printWidth: 100,
	semi: false,
	useTabs: true,
	bracketSpacing: true,
	bracketSameLine: true,
	singleQuote: true,
	overrides: [
		{
			files: ['*.yml', '*.md'],
			options: {
				tabWidth: 2,
				useTabs: false,
				singleQuote: false
			}
		}
	]
}

import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'

export default defineConfig([
	typescriptEslint.configs.recommended,
	{
		files: ['**/*.ts', '**/*.tsx'],
		rules: {
			'typescript-eslint/no-unused-vars': [
				2,
				{
					args: 'none'
				}
			]
		}
	},
	eslintConfigPrettier,
	{
		files: ['**/*.js'],
		extends: ['js/recommended'],
		plugins: { js },
		languageOptions: {
			globals: {
				...globals.node,
				Atomics: 'readonly',
				SharedArrayBuffer: 'readonly'
			},
			ecmaVersion: 2018,
			sourceType: 'module'
		},
		rules: {
			quotes: [
				2,
				'single',
				{
					avoidEscape: true
				}
			]
		}
	}
])

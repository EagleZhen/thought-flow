import * as path from 'path';
import Mocha from 'mocha';
import * as fs from 'fs';

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 10000 // Increase timeout for extension tests
	});

	const testsRoot = path.resolve(__dirname, '..');

	return new Promise((c, e) => {
		// Find all test files
		const files: string[] = [];

		function findTests(dir: string) {
			const entries = fs.readdirSync(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);

				if (entry.isDirectory()) {
					findTests(fullPath);
				} else if (entry.name.endsWith('.test.js')) {
					files.push(fullPath);
				}
			}
		}

		try {
			findTests(testsRoot);

			// Add files to the test suite
			files.forEach((f: string) => mocha.addFile(f));

			// Run the mocha test
			mocha.run((failures: number) => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c();
				}
			});
		} catch (err) {
			console.error(err);
			e(err);
		}
	});
}

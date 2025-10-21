import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Test suite for the Python Call Hierarchy extension.
 * Tests basic extension activation and command registration.
 */
suite('Python Call Hierarchy Extension Test Suite', () => {
	vscode.window.showInformationMessage('Starting Python Call Hierarchy tests.');

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('undefined_publisher.call-hierarchy-demo'));
	});

	test('Command should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('callHierarchyDemo.showCallHierarchy'), 
			'The showCallHierarchy command should be registered');
	});

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(0, [1, 2, 3].indexOf(1));
	});
});

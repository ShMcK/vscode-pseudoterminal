'use strict';

import * as vscode from 'vscode';
import { exec as cpExec } from 'child_process';
import { promisify } from 'util';

const exec = promisify(cpExec);

const formatText = (text: string) => {
	return `\r${text.split(/(\r?\n)/g).join('\r')}\r`;
};

/**
 * Settings
 */

const defaultLine = '→ ';

const keys = {
	enter: '\r',
	backspace: '\x7f',
};

const actions = {
	cursorBack: '\x1b[D',
	deleteChar: '\x1b[P',
	clear: '\x1b[2J\x1b[3J\x1b[;H'
};

/** Extension */

export function activate(context: vscode.ExtensionContext) {
	const writeEmitter = new vscode.EventEmitter<string>();
	context.subscriptions.push(
		vscode.commands.registerCommand('extensionTerminalSample.create', () => {
			// content
			let content = defaultLine;
			const workspaceRoots: readonly vscode.WorkspaceFolder[] | undefined =
				vscode.workspace.workspaceFolders;
			if (!workspaceRoots || !workspaceRoots.length) {
				// no workspace root
				return '';
			}
			const workspaceRoot: string = workspaceRoots[0].uri.fsPath || '';

			const pty = {
				onDidWrite: writeEmitter.event,
				open: () => writeEmitter.fire(content),
				close: () => {},
				handleInput: async (char: string) => {
					switch (char) {
						case keys.enter:
							// writeEmitter.fire(char);
							writeEmitter.fire(`\r${content}\r\n`)
							const command = content.slice(defaultLine.length); // trim off leading default prompt
							const { stdout, stderr } = await exec(command, {
								encoding: 'utf8',
								cwd: workspaceRoot,
							});
							
							if (stdout) {
								const output = formatText(stdout);
								writeEmitter.fire(output);
							}

							if (stderr && stderr.length) {
								writeEmitter.fire(formatText(stderr));
							}
							content = defaultLine;
							writeEmitter.fire(`\r${content}`);
							return;
						case keys.backspace:
							if (content.length <= defaultLine.length) {
								return;
							}
							content = content.substr(0, content.length - 1);
							writeEmitter.fire(actions.cursorBack);
							writeEmitter.fire(actions.deleteChar);
							return;
						default:
							// typing
							content += char;
							writeEmitter.fire(char);
					}
				},
			};
			const terminal = (<any>vscode.window).createTerminal({
				name: `PseudoTerminal Demo`,
				pty,
			});
			terminal.show();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('extensionTerminalSample.clear', () => {
			writeEmitter.fire(actions.clear);
		})
	);
}

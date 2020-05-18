"use strict";

import * as vscode from "vscode";
import { exec as cpExec } from "child_process";
import { promisify } from "util";

// promisified Node executable (Node 10+)
const exec = promisify(cpExec);

// Settings
const defaultLine = "→ ";
const keys = {
  enter: "\r",
  backspace: "\x7f",
};
const actions = {
  cursorBack: "\x1b[D",
  deleteChar: "\x1b[P",
  clear: "\x1b[2J\x1b[3J\x1b[;H",
};

// cleanup inconsitent line breaks
const formatText = (text: string) => `\r${text.split(/(\r?\n)/g).join("\r")}\r`;

export function activate(context: vscode.ExtensionContext) {
  const writeEmitter = new vscode.EventEmitter<string>();
  context.subscriptions.push(
    vscode.commands.registerCommand("pseudoTerminalExample.create", () => {
      // content
      let content = defaultLine;

      // handle workspaces
      const workspaceRoots: readonly vscode.WorkspaceFolder[] | undefined =
        vscode.workspace.workspaceFolders;
      if (!workspaceRoots || !workspaceRoots.length) {
        // no workspace root
        return "";
      }
      const workspaceRoot: string = workspaceRoots[0].uri.fsPath || "";

      const pty = {
        onDidWrite: writeEmitter.event,
        open: () => writeEmitter.fire(content),
        close: () => {},
        handleInput: async (char: string) => {
          switch (char) {
            case keys.enter:
              // preserve the run command line for history
              writeEmitter.fire(`\r${content}\r\n`);
              // trim off leading default prompt
              const command = content.slice(defaultLine.length);
              try {
                // run the command
                const { stdout, stderr } = await exec(command, {
                  encoding: "utf8",
                  cwd: workspaceRoot,
                });

                if (stdout) {
                  writeEmitter.fire(formatText(stdout));
                }

                if (stderr && stderr.length) {
                  writeEmitter.fire(formatText(stderr));
                }
              } catch (error) {
                writeEmitter.fire(`\r${formatText(error.message)}`);
              }
              content = defaultLine;
              writeEmitter.fire(`\r${content}`);
            case keys.backspace:
              if (content.length <= defaultLine.length) {
                return;
              }
              // remove last character
              content = content.substr(0, content.length - 1);
              writeEmitter.fire(actions.cursorBack);
              writeEmitter.fire(actions.deleteChar);
              return;
            default:
              // typing a new character
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
    vscode.commands.registerCommand("pseudoTerminalExample.clear", () => {
      writeEmitter.fire(actions.clear);
    })
  );
}

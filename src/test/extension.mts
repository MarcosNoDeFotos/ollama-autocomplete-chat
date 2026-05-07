import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { marked } from "marked";


let debounceTimer: NodeJS.Timeout | undefined;
let currentController: AbortController | null = null;
let requestId = 0;
let endpoint = "http://localhost:11434/api/generate";
let model = "llama3";
let activarAutocompletado = true;
let pre_prompt_explicarSeleccion = ""
let pre_prompt_modificarSeleccion = ""
let pre_prompt_autoCompletado = ""
let inlineCompletionDisposable: vscode.Disposable | undefined;
export function activate(context: vscode.ExtensionContext) {
    getConfig()

    registrarBotonesAyudaSeleccion(context)
    registrarComandos(context)
    actualizarRegistroAutocompletado()

    context.subscriptions.push({
        dispose: () => {
            inlineCompletionDisposable?.dispose();
            inlineCompletionDisposable = undefined;
        }
    });

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (
                e.affectsConfiguration('ollamaAutocompleteChat.activarAutocompletado') ||
                e.affectsConfiguration('ollamaAutocompleteChat.model') ||
                e.affectsConfiguration('ollamaAutocompleteChat.endpoint') ||
                e.affectsConfiguration('ollamaAutocompleteChat.promptExplicarSeleccion') ||
                e.affectsConfiguration('ollamaAutocompleteChat.promptModificarSeleccion') ||
                e.affectsConfiguration('ollamaAutocompleteChat.promptAutoCompletado')
            ) {
                getConfig();
                actualizarRegistroAutocompletado();
            }
        })
    );
}

function getConfig() {
    const config = vscode.workspace.getConfiguration('ollamaAutocompleteChat');
    activarAutocompletado = config.get<boolean>('activarAutocompletado') ?? true;
    model = config.get<string>('model') || 'llama3';
    endpoint = config.get<string>('endpoint') || 'http://localhost:11434/api/generate';
    pre_prompt_explicarSeleccion = config.get<string>('promptExplicarSeleccion') || '';
    pre_prompt_modificarSeleccion = config.get<string>('promptModificarSeleccion') || '';
    pre_prompt_autoCompletado = config.get<string>('promptAutoCompletado') || '';
}

function actualizarRegistroAutocompletado() {
    if (!activarAutocompletado) {
        inlineCompletionDisposable?.dispose();
        inlineCompletionDisposable = undefined;
        return;
    }

    if (!inlineCompletionDisposable) {
        inlineCompletionDisposable = registrarAutocompletado();
    }
}

function registrarComandos(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('ollamaAutocompleteChat.explicarSeleccion', async (selectedText, documentLanguage) => {
            var userPrompt: any = ""
            if (pre_prompt_explicarSeleccion.includes("{user-prompt}")) {
                userPrompt = await vscode.window.showInputBox({
                    placeHolder: "Formato de respuesta, explicar una parte concreta, etc",
                    prompt: "¿Quieres información adicional?",
                });

                if (!userPrompt) {
                    userPrompt = ""
                } else {
                    userPrompt += ". "
                }
            }


            var prompt = pre_prompt_explicarSeleccion.replaceAll("{document-language}", documentLanguage).replaceAll("{selected-text}", selectedText).replaceAll("{user-prompt}", userPrompt)
            //  `Explica este código en formato Markdown bien estructurado. ${userPrompt}El siguiente código está en lenguaje ${documentLanguage}:\n${selectedText}`
            const explicacion = await askOllama(
                prompt
            );

            renderizarRespuestaOllama(explicacion)
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('ollamaAutocompleteChat.modificarSeleccion', async (selectedText: string, selectionRange: vscode.Range, documentLanguage: string) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const userPrompt = await vscode.window.showInputBox({
                placeHolder: "Ej: Convierte esto a una función más eficiente",
                prompt: "¿Qué quieres modificar del código seleccionado?",
            });

            if (!userPrompt) {
                return
            }
            var prompt = pre_prompt_modificarSeleccion.replaceAll("{document-language}", documentLanguage).replaceAll("{selected-text}", selectedText).replaceAll("{user-prompt}", userPrompt)
            const modificacion = await requestCodeOllama(
                prompt,
                null
            );

            await editor.edit(editBuilder => {
                editBuilder.replace(selectionRange, modificacion);
            });
        })
    );
}


function renderizarRespuestaOllama(explicacion: string) {
    const panel = vscode.window.createWebviewPanel(
        "ollamaExplain",
        "Explicación IA",
        vscode.ViewColumn.Beside,
        {
            enableScripts: true
        }
    );

    const html = marked.parse(explicacion);

    panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                padding: 20px;
                background: #1e1e1e;
                color: #ddd;
            }

            pre {
                background: #2d2d2d;
                padding: 12px;
                border-radius: 8px;
                overflow-x: auto;
            }

            code {
                color: #f5bf2b;
            }

            h1, h2, h3 {
                color: #ffffff;
            }

            blockquote {
                border-left: 3px solid #555;
                padding-left: 10px;
                color: #aaa;
            }
        </style>
    </head>
    <body>
        ${html}
    </body>
    </html>
    `;
}


function registrarBotonesAyudaSeleccion(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { pattern: "**" },
            new class implements vscode.CodeActionProvider {

                provideCodeActions(document: vscode.TextDocument, range: vscode.Range) {

                    const actions: vscode.CodeAction[] = [];

                    const selectedText = document.getText(range);


                    if (!selectedText) return actions;

                    const explainAction = new vscode.CodeAction(
                        "🤖 Explicar con IA",
                        vscode.CodeActionKind.QuickFix
                    );

                    explainAction.command = {
                        title: "Explicar con IA",
                        command: "ollamaAutocompleteChat.explicarSeleccion",
                        arguments: [selectedText, document.languageId]
                    };

                    const refactorAction = new vscode.CodeAction(
                        "✨ Modificar con IA",
                        vscode.CodeActionKind.QuickFix
                    );

                    refactorAction.command = {
                        title: "Modificar con IA",
                        command: "ollamaAutocompleteChat.modificarSeleccion",
                        arguments: [selectedText, range, document.languageId]
                    };

                    actions.push(explainAction, refactorAction);

                    return actions;
                }
            }
        )
    );
}


function registrarAutocompletado(): vscode.Disposable {
    return vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**' },
        {
            provideInlineCompletionItems(document, position) {

                return new Promise((resolve) => {

                    if (!activarAutocompletado) {
                        return resolve([]);
                    }

                        if (debounceTimer) {
                            clearTimeout(debounceTimer);
                        }

                        debounceTimer = setTimeout(async () => {

                            const myRequestId = ++requestId;

                            const startLine = Math.max(0, position.line - 20);
                            var contextText = document.getText(
                                new vscode.Range(
                                    new vscode.Position(startLine, 0),
                                    position
                                )
                            );
                            var prompt = pre_prompt_autoCompletado.replaceAll("{document-language}", document.languageId).replaceAll("{selected-text}", contextText)
                            const linePrefix = document.lineAt(position).text.substring(0, position.character);

                            if (linePrefix.trim() === "") {
                                return resolve([]);
                            }

                            // Cancelar petición anterior
                            if (currentController) {
                                currentController.abort();
                            }

                            currentController = new AbortController();

                            try {
                                const suggestion = await requestCodeOllama(prompt, currentController.signal);

                                // Si llegó una petición más nueva → ignorar esta
                                if (myRequestId !== requestId) {
                                    return resolve([]);
                                }

                                if (!suggestion || suggestion.trim() === "") {
                                    return resolve([]);
                                }


                                resolve([
                                    new vscode.InlineCompletionItem(
                                        suggestion,
                                        new vscode.Range(position, position)
                                    )
                                ]);

                            } catch (err) {
                                // Si se aborta, ignoramos
                                return resolve([]);
                            }

                        }, 600); // ⏱️ tiempo de espera (ajústalo)

                });
            }
        }
    );
}







function cleanCode(response: string): string {
    return response
        .replace(/```[\w]*\n?/g, '')
        .replace(/```/g, '')
        .trim();
}



async function callOllama(prompt: string, signal: AbortSignal | null = null) {
    return await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: signal ?? undefined,
        body: JSON.stringify({
            model,
            prompt: prompt,
            stream: false
        })
    });
}


async function requestCodeOllama(prompt: string, signal: AbortSignal | null): Promise<string> {


    if (prompt.trim() === "") {
        return "";
    }

    const res = await callOllama(prompt, signal)

    const data: any = await res.json();
    return cleanCode(data.response);
}
async function askOllama(prompt: string): Promise<string> {

    // Debug

    if (prompt.trim() === "") {
        return "";
    }

    const res = await callOllama(prompt)

    const data: any = await res.json();
    return data.response;
}

// This method is called when your extension is deactivated
export function deactivate() { }
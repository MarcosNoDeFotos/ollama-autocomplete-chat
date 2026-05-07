import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { marked } from "marked";


// Debug
var llamadas = 0;
let debounceTimer: NodeJS.Timeout | undefined;
let currentController: AbortController | null = null;
let requestId = 0;
let endpoint = "http://localhost:11434/api/generate";
let model = "llama3";
export function activate(context: vscode.ExtensionContext) {
    registrarBotonesAyudaSeleccion(context)
    registrarAutocompletado(context)
    registrarComandos(context)

    getConfig()

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('ollamaAutocompleteChat.model') || e.affectsConfiguration('ollamaAutocompleteChat.endpoint')) {
                getConfig();
            }
        })
    );
}

function getConfig() {
    const config = vscode.workspace.getConfiguration('ollamaAutocompleteChat');
    model = config.get<string>('model') || 'llama3';
    endpoint = config.get<string>('endpoint') || 'http://localhost:11434/api/generate';
}

function registrarComandos(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('ollamaAutocompleteChat.explicarSeleccion', async (selectedText, documentLanguage) => {

            var userPrompt = await vscode.window.showInputBox({
                placeHolder: "Formato de respuesta, explicar una parte concreta, etc",
                prompt: "¿Quieres información adicional?",
            });

            if (!userPrompt) {
                userPrompt = ""
            }else{
                userPrompt += ". "
            }
            
            const explicacion = await askOllama(
                `Explica este código en formato Markdown bien estructurado. ${userPrompt}El siguiente código está en lenguaje ${documentLanguage}:\n${selectedText}`
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
            const explicacion = await requestCodeOllama(
                `Eres un agente que me ayudará a programar en ${documentLanguage}. En las respuestas solo devuelves código y comentarios, sin texto adicional. Haz el siguiente cambio:\n${userPrompt}\n\nEl código en el que debes hacer el cambio es este:\n${selectedText}`,
                null
            );
            
            await editor.edit(editBuilder => {
            editBuilder.replace(selectionRange, explicacion);
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


function registrarAutocompletado(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**' },
            {
                provideInlineCompletionItems(document, position) {

                    return new Promise((resolve) => {

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
                            contextText = `Eres un agente que autocompleta código en lenguaje ${document.languageId}. Solo respondes con código y comentarios. No repitas código. Continúa este bloque, y si es un comentario, inserta un salto de línea al principio:\n${contextText}`

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
                                const suggestion = await requestCodeOllama(contextText, currentController.signal);

                                // Si llegó una petición más nueva → ignorar esta
                                if (myRequestId !== requestId) {
                                    return resolve([]);
                                }

                                if (!suggestion || suggestion.trim() === "") {
                                    return resolve([]);
                                }

                                console.log("Código sugerido:\n" + suggestion);

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
        )
    );
}







function cleanCode(response: string): string {
    return response
        .replace(/```[\w]*\n?/g, '') 
        .replace(/```/g, '')
        .trim();
}



async function callOllama(prompt: string, signal: AbortSignal | null = null){
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

    // Debug
    llamadas++;

    if (prompt.trim() === "") {
        return "";
    }
    // Debug
    console.log("Llamadas: " + llamadas);

    const res = await callOllama(prompt, signal)

    const data : any = await res.json();
    return cleanCode(data.response);
}
async function askOllama(prompt: string): Promise<string> {

    // Debug

    if (prompt.trim() === "") {
        return "";
    }

    const res = await callOllama(prompt)

    const data : any = await res.json();
    return data.response;
}

// This method is called when your extension is deactivated
export function deactivate() { }


# Ollama Autocomplete and Chat (VS Code)

Extensión de VS Code que se conecta a **Ollama** (IA local) para:

- Autocompletar código en línea (inline) mientras escribes.
- Explicar un fragmento de código seleccionado con IA.
- Modificar/re-escribir el código seleccionado con IA.

> Todo ocurre contra tu endpoint de Ollama (por defecto, en tu máquina).

## Requisitos

- VS Code `>= 1.118.0`
- Ollama instalado y ejecutándose
- Un modelo disponible en Ollama (por defecto `llama3`)

Ejemplo (si usas el modelo por defecto):

```bash
ollama pull llama3
ollama serve
```

## Cómo funciona

### 1) Autocompletado inline

- La extensión registra un proveedor de autocompletado inline para cualquier archivo.
- Usa el contexto de las últimas líneas del documento (hasta ~20) y pide a Ollama que **continúe el bloque** devolviendo solo **código y comentarios**.
- La sugerencia aparece como “ghost text” (texto tenue). Acepta la sugerencia con la tecla configurada en VS Code para inline suggestions (habitualmente `Tab`).

### 2) Explicar selección con IA

1. Selecciona código.
2. Abre el menú de acciones rápidas (bombilla / `Ctrl+.`).
3. Elige **“🤖 Explicar con IA”**.
4. (Opcional) Escribe un extra en el prompt (formato, foco en una parte, etc.).
5. Se abrirá un panel a la derecha con una explicación en **Markdown**.

### 3) Modificar selección con IA

1. Selecciona código.
2. Abre el menú de acciones rápidas (bombilla / `Ctrl+.`).
3. Elige **“✨ Modificar con IA”**.
4. Escribe qué quieres cambiar (p. ej. “convierte esto en una función más eficiente”).
5. La extensión reemplaza el texto seleccionado por el **código modificado** devuelto por Ollama.

## Configuración

La extensión expone estas opciones en Settings:

- `ollamaAutocompleteChat.activarAutocompletado`: activa/desactiva el autocompletado inline.
	- Por defecto: `true`
- `ollamaAutocompleteChat.numeroLineasContexto`: Número de líneas que se envían al modelo como contexto para autocompletar el código.
	- Por defecto: `20`
- `ollamaAutocompleteChat.endpoint`: endpoint de generación de Ollama.
	- Por defecto: `http://localhost:11434/api/generate`
- `ollamaAutocompleteChat.model`: nombre del modelo.
	- Por defecto: `llama3`

### Prompts configurables

Puedes personalizar los prompts que se envían a Ollama (son textos largos y en el panel de Settings aparecen como campo multilínea):

- `ollamaAutocompleteChat.promptExplicarSeleccion`: prompt para **explicar** el texto seleccionado.
- `ollamaAutocompleteChat.promptModificarSeleccion`: prompt para **modificar** el texto seleccionado.
- `ollamaAutocompleteChat.promptAutoCompletado`: prompt para **autocompletado inline**.

### Variables (placeholders)

Dentro de los prompts puedes usar estas variables, que la extensión reemplaza antes de llamar a Ollama:

- `{document-language}`: el `languageId` del documento (p. ej. `typescript`, `python`, `json`).
- `{selected-text}`: el texto de contexto.
	- En explicar/modificar: el texto seleccionado.
	- En autocompletado: las últimas ~20 líneas hasta el cursor. (Se puede configurar el número de líneas a incluir)
- `{user-prompt}`: texto adicional introducido por el usuario.
	- En **Explicar**: solo se pregunta al usuario si el prompt contiene `{user-prompt}`.
	- En **Modificar**: se pregunta siempre (si se cancela, no se aplica ningún cambio).

Disponibilidad por prompt:

- `promptAutoCompletado`: `{document-language}`, `{selected-text}`
- `promptExplicarSeleccion`: `{document-language}`, `{selected-text}`, `{user-prompt}`
- `promptModificarSeleccion`: `{document-language}`, `{selected-text}`, `{user-prompt}`

Ejemplo en `settings.json`:

```json
{
	"ollamaAutocompleteChat.activarAutocompletado": true,
	"ollamaAutocompleteChat.endpoint": "http://localhost:11434/api/generate",
	"ollamaAutocompleteChat.model": "llama3",
	"ollamaAutocompleteChat.promptAutoCompletado": "Eres un agente que autocompleta código en lenguaje {document-language}. Solo respondes con código y comentarios. No repitas código. Continúa este bloque, y si es un comentario, inserta un salto de línea al principio:\n{selected-text}"
}
```

## Solución de problemas

- No aparecen sugerencias: comprueba que Ollama está levantado y que el `endpoint` responde.
- El modelo no existe: instala el modelo con `ollama pull <modelo>`.
- Respuestas con ``` y texto extra: la extensión intenta limpiar los fences, pero depende del modelo y del prompt.


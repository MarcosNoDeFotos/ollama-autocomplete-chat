
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

- `ollamaAutocompleteChat.endpoint`: endpoint de generación de Ollama.
	- Por defecto: `http://localhost:11434/api/generate`
- `ollamaAutocompleteChat.model`: nombre del modelo.
	- Por defecto: `llama3`

Ejemplo en `settings.json`:

```json
{
	"ollamaAutocompleteChat.endpoint": "http://localhost:11434/api/generate",
	"ollamaAutocompleteChat.model": "llama3"
}
```

## Solución de problemas

- No aparecen sugerencias: comprueba que Ollama está levantado y que el `endpoint` responde.
- El modelo no existe: instala el modelo con `ollama pull <modelo>`.
- Respuestas con ``` y texto extra: la extensión intenta limpiar los fences, pero depende del modelo y del prompt.

